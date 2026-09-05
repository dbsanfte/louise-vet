# Louise's Vet Office — first playable slice

Made for Louise, with a warm, friendly tone suitable for ages 7+. Mistakes invite
another try; there is no blood, animal death, countdown, or punishment for taking
time to read. The care is fictional and simplified, with no real dosages or
instructions for treating real pets.

## The loop

1. Choose a waiting patient in the isometric reception. New neighbours arrive
   about every 22 seconds of active play, up to four patients including the pet
   being treated. Animals and their people enter from the side doorway, then walk
   toward Louise behind the counter at the back. Waiting customers keep their
   places when another neighbour arrives.
2. Enter the 3D examination room. Read the owner's story and select a diagnostic
   tool. Hold and drag it across the animal to inspect the actual model; tapping
   a body guide places the tool for you. Choose **Look around** to orbit, or use
   rotation buttons while holding the tool. Optical viewers have zoom controls.
3. Collect two key findings and choose the diagnosis that fits. Other sensible
   examinations also return observations, including healthy results; those checks
   stay in the care notes without counting as the two key clues. The care notebook
   offers friendly reminders. Wrong answers allow a retry.
4. Choose the care tool and body location shown in the plan. Stop the moving dot
   in the green zone to apply care. Misses allow a retry and gently reduce the
   final score. There is no time limit.
5. Receive satisfaction, a fee, a tip, and a retail sale if treats are stocked.
   Return to reception to help another patient or spend coins in the clinic shop.

Scheduled vaccination visits skip examination and diagnosis. Find the matching
body spot from the placement clue, then give the vaccine in the green timing
zone. A wrong location or missed timing leaves the vaccine unapplied for another
try. The completion message celebrates a finished routine visit.

During any unfinished visit, **Stop visit** returns the patient to the front of
the waiting queue, cancels any active treatment, and awards no coins. Restarting
the visit clears its clues and attempts. This control and **Choose a diagnosis**
stay fixed at the bottom of the screen; care notes scroll within their own panel.
The interface uses locally bundled Nunito lettering with larger reading text.

Dogs, cats, rabbits, hamsters, gerbils, and goldfish have original Blender models.
Ten visits cover a bee sting, irritated ear, fractured front leg, fleas, tangled
fur, fish water care, vaccination, tartar cleaning, a splinter, and a tooth cavity.
The cavity case finishes with gentle cleaning and a dental appointment; brushing
does not claim to repair the cavity.

## Progress and purchases

Animal/customer satisfaction is averaged across completed visits. Wallet coins
and lifetime earnings are separate. Plants and a bench add satisfaction bonuses;
a care station widens the timing target; a poster increases arrivals; expansion
adds a visible annex and increases capacity to six. Treat stock supports retail
sales, and can be replenished repeatedly. Other upgrades are bought once.

Completed rewards, purchases, stock, and sound preference save to localStorage
on the current browser and origin. Reloading starts a fresh waiting queue and
restarts an unfinished visit. Progress is not shared between port 5173 and 8080,
between devices, or after clearing site data. No account or backend is involved.

## Direction after this slice

The present slice proves the complete game loop with compact authored cases.
Examination now includes draggable 3D instruments, real-time magnified fur,
complete 3D skeletal scans with a displaced fracture, lit healthy/abnormal ear
and mouth interiors, and an ECG with matching heartbeat audio. Written notes
record findings after inspection. Treatment still uses placement and timing;
physical cream spreading and tissue deformation are future work. People and pets now play Blender-authored walking and
idle clips, with three customer appearances including women. Hardware graphics
render animation every frame; software graphics use a lighter display cadence.
The care timing challenge holds the scene still while the meter runs.
The shop uses fixed placements and one expansion rather than a room
layout editor. Longer campaigns, richer diagnostic skill games, broader pet
variation, and narrated reading support can build on this foundation.
