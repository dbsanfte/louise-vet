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
commit-tagged and `latest` images to GHCR, then pass the **published image digest**
to the dedicated `louise-vet-eqvm` runner. Kubernetes pulls that exact image from
GHCR; the deployment job does not download or import an image archive.
The runner's `louise-vet-deploy` label selects the deployment job. The `production`
GitHub environment accepts `main` only.

The repository is `dbsanfte/louise-vet`; the container package remains
`ghcr.io/dbsanfte/vet-game`. Build, browser verification, publication and the
installed helper all use that stable image name. Renaming the repository must
not silently change the published image name. Archives still transfer the one
built image between CI build, browser-test and publication jobs.

The runner runs as the separate `louise-runner` Unix account, without Docker group
membership or general sudo/cluster credentials. Its sole sudo entry invokes the
root-owned `/usr/local/sbin/louise-deploy`. That helper accepts a full commit SHA
and SHA-256 registry digest, updates only `louise-vet/web` to
`ghcr.io/dbsanfte/vet-game:<commit>@sha256:<digest>` with `imagePullPolicy:
IfNotPresent`, waits for readiness and a valid certificate, and checks the
served `/version.json` revision. Failed rollout/local HTTPS checks restore the
previous image when one exists. Pod readiness can precede Traefik's endpoint
updates, so the helper allows up to ten health-and-revision attempts with
three seconds between attempts and five-second request limits. Every attempt
requires trusted TLS, an `ok` health response, and the expected image revision;
persistent failures still roll back. A separate GitHub-hosted job verifies public DNS,
HTTPS, redirect, game title, revision and missing-asset 404s from outside the LAN.
A public-check failure is reported; it does not undo an otherwise healthy local rollout.

The deployment has two non-root, read-only Nginx pods with rolling updates and
health probes. Pods pull a missing image from GHCR, including after a restart or
image-cache cleanup. Digest pinning keeps recovery on the tested release even if
a tag changes. Registry access must remain available after the CI job finishes;
the job's short-lived `GITHUB_TOKEN` must not become a Kubernetes pull secret.
Two pods protect rolling updates, not failure of the host/router/internet link.

The repository, served game and runtime assets are public.
No accounts or cloud saves are introduced. Browser saves belong to the origin:
progress from localhost does not automatically appear on `https://louise.vet`.

### Registry access

A public GHCR package supports anonymous pulls without a Kubernetes secret.
Package visibility is separate from repository visibility; a public repository
does not automatically make its container package public.

A private package instead needs a dedicated classic GitHub token with
`read:packages` and access to this package. Store its Docker authentication file
outside the checkout, create a `kubernetes.io/dockerconfigjson` secret named
`ghcr-pull` in `louise-vet`, and reference it in the Deployment's
`spec.template.spec.imagePullSecrets`. Keep the token out of command arguments,
logs and Git; rotate it before expiry. Do not use a workflow token for this
persistent credential. See [GHCR authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
and [Kubernetes registry secrets](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/).

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

`/var/lib/louise-vet/current-revision` and `current-image` record the last
successful local deployment and its full registry reference. Kubernetes retains
five old ReplicaSets; inspect those or the successful CI run's publication output
for a previous commit and digest. Retain corresponding GHCR versions for rollback.
An administrator can explicitly restore a known version:

```sh
sudo kubectl -n louise-vet get replicasets -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image
sudo /usr/local/sbin/louise-deploy FULL_PREVIOUS_COMMIT_SHA sha256:PREVIOUS_IMAGE_DIGEST
```

For a 404 with healthy DNS/TLS, inspect pods and service endpoints first. Traefik
can return 404 when there are no ready game backends. `ErrImageNeverPull` identifies
an older Deployment that cannot recover a missing image: install the current
helper, confirm registry access, and redeploy the intended commit and digest.
`ImagePullBackOff` requires checking the pod events for registry access, a missing
image, or network failures. Do not change the domain or certificate to hide those
failures. Check public `/healthz`, `/version.json`, the game page and browser load
after recovery, with normal TLS validation.

The older archive-import deployment is superseded; existing archives are left
untouched but the helper no longer accepts `--cached` or image data on stdin.
Manual rollback remains until the next successful main deployment. Server backups
should cover k3s data (including certificate/account secrets), the runner install,
`/etc/louise-vet`, the helper/sudo rule, and release records. All current
cluster/Traefik/cert-manager versions are inherited from the host; upgrading shared
infrastructure is a separate maintenance task.
