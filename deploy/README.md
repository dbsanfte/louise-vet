# Production hosting

The game is hosted at **https://louise.vet/** on `eqvm` (`192.168.50.100`).
The machine runs **single-node k3s**, Traefik 2.9 and cert-manager 1.13;
it is not a k3d Docker cluster. Existing applications and their runner are independent.

## DNS and certificates

Squarespace DNS should have one apex `ALIAS` record: `@ → home.sanftenberg.net`,
replacing its default apex A records. Squarespace requires DNSSEC to be disabled
for ALIAS records. `home.sanftenberg.net` is a CNAME to
`sanftenberg.dnsalias.org`, maintained by the existing `ddclient` service on eqvm.
This chain follows home IP changes without an additional updater. See
[Squarespace ALIAS instructions](https://support.squarespace.com/hc/en-us/articles/31119879125645-DNS-records-for-web-hosting).
When first disabling DNSSEC, the registry DS removal and resolver caches must
settle before ACME can validate the name; a stale DS with missing DNSKEY records
causes SERVFAIL even if the ALIAS is correct. cert-manager retries failed issuance.
A direct apex A record works as a temporary alternative but must be updated when
the router's public IP changes. DNS caches can retain earlier records for their TTL.

The router forwards ports 80 and 443 to eqvm. Only `louise.vet` is configured;
`www` is not an alternate game origin. Traefik redirects this domain's HTTP
requests to HTTPS. The existing `letsencrypt-prod` ClusterIssuer issues and renews
`louise-vet/louise-vet-tls` through HTTP-01; leave port 80 reachable for renewals.
The ACME solver's more-specific challenge route bypasses the game redirect.
[cert-manager ingress configuration](https://cert-manager.io/docs/usage/ingress/)
describes this certificate management.

## Pipeline

The [workflow](../.github/workflows/ci.yml) builds once, checks formatting/types and
unit tests, and tests that same Nginx image across four browser-test shards on
GitHub-hosted machines. Pull requests never deploy. Successful `main` runs publish
commit-tagged and `latest` images to private GHCR, then send the **same tested image
artifact** to the dedicated `louise-vet-eqvm` runner. Its `louise-vet-deploy` label
selects the deployment job. The `production` GitHub environment accepts `main` only.

The repository is `dbsanfte/louise-vet`; the container package remains
`ghcr.io/dbsanfte/vet-game`. Build, browser verification, publication and the
installed helper all use that stable image name. Renaming the repository must
not silently change the published image name or the archive's image reference.

The runner runs as the separate `louise-runner` Unix account, without Docker group
membership or general sudo/cluster credentials. Its sole sudo entry invokes the
root-owned `/usr/local/sbin/louise-deploy`. That helper accepts a full commit SHA
and a matching single-image Docker archive, imports it into k3s containerd, updates
only `louise-vet/web`, waits for readiness and a valid certificate, and checks the
served `/version.json` revision. Failed rollout/local HTTPS checks restore the
previous image when one exists. Pod readiness can precede Traefik's endpoint
updates, so the helper allows up to ten health-and-revision attempts with
three seconds between attempts and five-second request limits. Every attempt
requires trusted TLS, an `ok` health response, and the expected image revision;
persistent failures still roll back. A separate GitHub-hosted job verifies public DNS,
HTTPS, redirect, game title, revision and missing-asset 404s from outside the LAN.
A public-check failure is reported; it does not undo an otherwise healthy local rollout.

The deployment has two non-root, read-only Nginx pods with rolling updates and
health probes. Both pods use the single node's imported image (`imagePullPolicy:
Never`), so no expiring GHCR pull token is stored on the cluster. Moving to multiple
nodes requires importing images to each node or configuring durable registry access.
Two pods protect rolling updates, not failure of the host/router/internet link.

The repository remains private; the served game and its runtime assets are public.
No accounts or cloud saves are introduced. Browser saves belong to the origin:
progress from localhost does not automatically appear on `https://louise.vet`.

## Server files and first-time setup

The installed runner lives at `/opt/louise-runner`; its service is
`actions.runner.dbsanfte-vet-game.louise-vet-eqvm.service`, enabled at boot. Runner
registration credentials belong to GitHub's runner installation, not the repo.
The SSH password file used during setup stays outside Git and is not used by CI.

An administrator installs these checked-in manifests and helper on the server:

```sh
sudo kubectl apply -f deploy/namespace.yaml
sudo kubectl apply -f deploy/web.yaml -f deploy/ingress.yaml
sudo install -o root -g root -m 0755 deploy/louise-deploy /usr/local/sbin/louise-deploy
```

The manifests are also copied to `/etc/louise-vet/` for local administration.
`web.yaml` deliberately starts with a `bootstrap` image; do not reapply it over a
live release without replacing its image with the currently deployed SHA first.
The helper is **not automatically replaced by the workflow**: changes to this
privileged file require an administrator to review and install the new version.
Only the following sudo rule is needed in `/etc/sudoers.d/louise-vet` (0440):

```sudoers
louise-runner ALL=(root) NOPASSWD: /usr/local/sbin/louise-deploy
```

Register a separate repository runner using GitHub's short-lived registration
token and install its service as `louise-runner`; keep tokens out of command logs
and source. The existing runner for another repository must not be reconfigured.

## Operation and recovery

```sh
# From a checkout with GitHub access: run the entire checked deployment pipeline.
gh workflow run ci.yml --ref main
gh run list --workflow ci.yml

# On eqvm: inspect health without printing secret data.
sudo kubectl -n louise-vet get deployment,pods,ingress,certificate
sudo kubectl -n louise-vet logs deployment/web --tail=50
sudo systemctl status actions.runner.dbsanfte-vet-game.louise-vet-eqvm
curl --fail https://louise.vet/version.json
```

Five successful image archives are retained in `/var/lib/louise-vet/images/` and
`/var/lib/louise-vet/current-revision` records the last successful local deployment.
An administrator can list those archives and explicitly restore a known version:

```sh
sudo ls /var/lib/louise-vet/images/
sudo /usr/local/sbin/louise-deploy FULL_PREVIOUS_COMMIT_SHA --cached
```

If containerd garbage-collects an unused image, `--cached` reimports its retained
archive. For older releases, pull the private GHCR commit tag with authorized
registry access, `docker save` just that tag, and feed the archive to the helper.
Manual rollback remains until the next successful main deployment. Server backups
should cover k3s data (including certificate/account secrets), the runner install,
`/etc/louise-vet`, the helper/sudo rule, and retained release archives. All current
cluster/Traefik/cert-manager versions are inherited from the host; upgrading shared
infrastructure is a separate maintenance task.
