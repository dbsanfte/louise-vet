/** Complete, context-specific lines. Only {friend} is substituted with a name.
 * The keys are existing activity labels, never prefixes added to the dialogue.
 * Each pet bank has two voices so pets sharing an owner have different thoughts.
 */
export type Dialogue = { pet?: readonly [string, string]; owner?: string };
export const dialogue: Record<string, Dialogue> = {};
function pets(keys: string[], first: string, second: string) {
  for (const key of keys)
    dialogue[key] = { ...dialogue[key], pet: [first, second] };
}
function owners(keys: string[], lines: string) {
  for (const key of keys) dialogue[key] = { ...dialogue[key], owner: lines };
}

// Clinic attractions and species-specific food.
pets(
  ['Ooh, lovely scratch!', 'Purrr… lovely scratch!'],
  'That feels good, {friend}.|{friend}, I found a good scratching spot.|One more scratch before I go back to {friend}.|{friend} can wait while I stretch.|{friend}, this post is just right.',
  '{friend}, I can really stretch here.|I could scratch here all day, {friend}.|{friend}, this is better than the sofa.|A good stretch, then back to {friend}.|{friend}, I like this scratching post.',
);
pets(
  ['Little legs, go go go!'],
  'Look how fast I can go, {friend}!|{friend}, I want another turn on the wheel.|{friend}, my wheel keeps going round!|A bit more running, then a rest with {friend}.|{friend}, this is a good place to run.',
  "{friend}, I'm getting the hang of this wheel.|I like running at my own speed, {friend}.|{friend}, I can stop for a rest whenever I want.|One more run before I see {friend}.|{friend}, it's fun making the wheel turn.",
);
pets(
  ['Whee! Round we go!', 'Whee!'],
  'Whee! Can you see me, {friend}?|{friend}, here I come again!|Round we go, {friend}!|{friend}, I want another ride!|I can see {friend} every time I go round.',
  "{friend}, I like going round on this ride.|There's {friend} again!|{friend}, this is a lovely slow ride.|One more time round, {friend}.|I'll go back to {friend} when the ride stops.",
);
pets(
  ['Wheee! Here comes the hill!'],
  'Wheee! Look at me, {friend}!|{friend}, here comes the hill!|Up we go, {friend}!|{friend}, I want to ride the coaster again!|Whee! I can see {friend} down there.',
  "{friend}, the coaster is going up again.|Here comes the fun bit, {friend}!|{friend}, that hill made my tummy tickle.|I'll find {friend} when the coaster stops.|{friend}, I liked that little hill.",
);
pets(
  ['Wow! I can see my house!'],
  "Look how high I am, {friend}!|{friend}, I can see over the fence!|There's {friend}, down by the wheel!|{friend}, everything looks smaller from here.|I want to show {friend} the view.",
  "{friend}, it's quiet up here.|I can watch the town from here, {friend}.|{friend}, the wheel is taking me up slowly.|I'll be back down soon, {friend}.|I like this view, {friend}.",
);
pets(
  ['Ooh! My favourite toy!', 'Come back, bouncy ball!'],
  '{friend}, look at this toy!|I want to show {friend} what I found.|{friend}, can we play with this one?|One more game before I go back to {friend}.|{friend}, this toy is fun!',
  "{friend}, I picked out a toy.|I think {friend} would like this one too.|{friend}, I could play here for ages.|I'll bring this toy over to {friend}.|{friend}, let's play together.",
);
pets(
  ['Mmm, yummy!', 'Yum! Crunchy doggy treats!'],
  '{friend}, these treats are crunchy!|I like these dog treats, {friend}.|{friend}, I found a tasty snack.|One more crunch, then back to {friend}.|{friend}, that was a good treat.',
  "{friend}, I'm taking my time with this treat.|These dog treats smell good, {friend}.|{friend}, there's a snack here for me.|I wonder if {friend} knows how tasty this is.|{friend}, I like the crunchy bits.",
);
pets(
  ['Purrr… tasty kitty nibbles!'],
  '{friend}, these cat treats smell good.|I like these little nibbles, {friend}.|{friend}, this is a tasty treat.|I hope {friend} remembers these cat treats.|{friend}, I found my snack.',
  "{friend}, I'll eat these treats slowly.|These nibbles are just right, {friend}.|{friend}, I like this little snack.|I can smell the cat treats from here, {friend}.|{friend}, those treats were worth waiting for.",
);
pets(
  ['Chirp! Lovely little seeds!'],
  '{friend}, I found some seeds.|These little seeds are tasty, {friend}.|{friend}, I like picking out the seeds.|A few more seeds, then back to {friend}.|{friend}, this is a good snack.',
  "{friend}, I'm busy with these seeds.|I like this seed mix, {friend}.|{friend}, there are little seeds here for me.|I'll finish this seed before I see {friend}.|{friend}, that was a tasty beakful.",
);
pets(
  ['Nibble, nibble! Yummy greens!'],
  '{friend}, these greens are crunchy.|I like these leaves, {friend}.|{friend}, I found a leafy snack.|One more nibble before I see {friend}.|{friend}, these greens taste good.',
  "{friend}, I'm taking little bites.|These leaves smell fresh, {friend}.|{friend}, I could nibble here for a while.|I like having greens for a snack, {friend}.|{friend}, I'll finish this leaf first.",
);
pets(
  ['Mmm! A snack for my cheeks!'],
  '{friend}, I can tuck this snack in my cheeks.|A little nibble now, {friend}.|{friend}, I found something crunchy.|I can save some of this for later, {friend}.|{friend}, my cheeks have room for a snack.',
  "{friend}, this snack fits in my paws.|I like taking tiny bites, {friend}.|{friend}, I have a bit saved in my cheeks.|A quiet snack before I go back to {friend}.|{friend}, I'm busy nibbling.",
);
pets(
  ['Crunch! Tasty little grains!'],
  '{friend}, I found some crunchy grains.|These little grains taste good, {friend}.|{friend}, I can hold this snack in my paws.|A few more nibbles, then back to {friend}.|{friend}, I like this grain mix.',
  "{friend}, I'm choosing a grain to nibble.|This is a good little snack, {friend}.|{friend}, I'll eat this bit slowly.|I like the crunchy grains, {friend}.|{friend}, there's a snack here just for me.",
);
pets(
  ['Bloop! Delicious fish flakes!'],
  "{friend}, the fish flakes are floating down.|I can see my food, {friend}.|{friend}, I'm swimming up for a flake.|These flakes taste good, {friend}.|{friend}, I found another little flake.",
  "{friend}, it's feeding time.|I like catching the sinking flakes, {friend}.|{friend}, there's a flake over here.|I'll swim over to my food, {friend}.|{friend}, that was a tasty fish flake.",
);
pets(
  ['Ahh! A cool drink!'],
  '{friend}, I needed a drink.|This water is cool, {friend}.|{friend}, I found the water bowl.|A drink, then more playing with {friend}.|{friend}, I feel better after that water.',
  "{friend}, I'm stopping for some water.|A quiet drink is nice, {friend}.|{friend}, there's fresh water here.|I'll finish my drink before I see {friend}.|{friend}, that water was just what I wanted.",
);
pets(
  ['Pop! Got that bubble!'],
  '{friend}, I caught a bubble!|There goes another bubble, {friend}!|{friend}, it popped before I could catch it.|I want to chase that big bubble, {friend}.|{friend}, look at all these bubbles!',
  "{friend}, a bubble landed beside me.|I'm watching the bubbles float past, {friend}.|{friend}, that bubble is coming this way.|I'll try to catch the next one, {friend}.|{friend}, the bubbles keep disappearing!",
);
pets(
  [
    'So cosy… purrr…',
    'Purrr… cosy dreams.',
    'Zzz… lovely dreams.',
    'A quiet rest.',
  ],
  "I'll rest here for a bit, {friend}.|This is a comfy spot, {friend}.|{friend}, I'm ready for a nap.|I can relax with {friend} nearby.|{friend}, I might close my eyes for a while.",
  "{friend}, it's nice and quiet here.|A little sleep sounds good, {friend}.|{friend}, I've found somewhere to curl up.|I'll stay here until {friend} is ready.|{friend}, I could get comfortable here.",
);
pets(
  ['Chirp! What a pretty tune!'],
  '{friend}, listen to those chimes!|I like that tinkling sound, {friend}.|{friend}, the chimes moved when I landed.|I want to hear the chimes again, {friend}.|{friend}, I can make a sound too!',
  "{friend}, the chimes sound lovely.|I'm listening from this perch, {friend}.|{friend}, I wonder which chime will ring next.|A little music before I see {friend}.|{friend}, that was a pretty sound.",
);
pets(
  ['Pounce! Silly wiggly yarn!', 'Flutter, flutter! Pounce!'],
  "{friend}, I'm going to catch it!|It moved again, {friend}!|{friend}, watch me pounce.|I nearly had it that time, {friend}.|{friend}, one more try!",
  "{friend}, I'm waiting for it to move.|I can reach it from here, {friend}.|{friend}, this is a good pouncing spot.|I'll watch it for a moment, {friend}.|{friend}, I caught it that time.",
);
pets(
  ['Flap, flap! Lovely space!', 'Flap, flap! Out with my family!'],
  "{friend}, there's room to fly here!|I can stretch my wings, {friend}.|{friend}, watch me fly over there.|I like flying near {friend}.|{friend}, I'll fly back in a moment.",
  "{friend}, I'm flying to that perch.|A short flight, then a rest near {friend}.|{friend}, I can see you from up here.|I like having space for my wings, {friend}.|{friend}, I'm coming back over.",
);
pets(
  ['My lovely leafy lookout!', 'Chirp! What a view!'],
  '{friend}, look at my new perch!|I can see you from here, {friend}.|{friend}, I found a branch to rest on.|This is a good lookout, {friend}.|{friend}, I like it up in the leaves.',
  "{friend}, it's peaceful on this branch.|I can watch from here, {friend}.|{friend}, I picked a shady perch.|I'll stay on this branch for a bit, {friend}.|{friend}, I can see the path from here.",
);
pets(
  ['My turn soon!'],
  "{friend}, I'm waiting for a turn.|I hope it's my turn next, {friend}.|{friend}, I'll wait behind this pet.|I want to try that too, {friend}.|{friend}, the queue is moving.",
  "{friend}, I can watch while I wait.|I'll have a go when there's room, {friend}.|{friend}, someone else is using it now.|I'm staying in the queue, {friend}.|{friend}, I can wait a little longer.",
);
pets(
  ['All aboard!'],
  "{friend}, it's my turn now!|Here I go, {friend}!|{friend}, there's room for me now.|I'm getting ready for my turn, {friend}.|{friend}, watch this!",
  "{friend}, I'll get settled first.|My turn has come, {friend}.|{friend}, I'm ready to have a go.|I can start now, {friend}.|{friend}, I'll try it slowly.",
);
pets(
  ['Ooh! Let us try this!'],
  "{friend}, I want to try that.|There's something to play with, {friend}!|{friend}, I'm going to have a look.|I wonder what that does, {friend}.|{friend}, let's go over there.",
  "{friend}, that looks interesting.|I'll take a closer look, {friend}.|{friend}, I might have a go at that.|I want to see what's over there, {friend}.|{friend}, I'm finding something to do.",
);
pets(
  ['Happy to wait with you.'],
  "{friend}, I'll wait beside you.|I like having {friend} nearby.|{friend}, I can stay here for a bit.|I'll keep {friend} company.|{friend}, I'm right here.",
  "{friend}, this is a good place to wait.|I'm staying close to {friend}.|{friend}, I don't mind a quiet break.|We can wait together, {friend}.|{friend}, I'll get comfortable beside you.",
);

// Park, home and ordinary journeys.
pets(
  ['Throw it again! Again!'],
  "{friend}, throw the ball again!|I'm bringing it back, {friend}!|{friend}, that was a good throw.|I found the ball, {friend}!|{friend}, I'm ready for another throw.",
  "{friend}, I'll fetch that ball.|I've got it, {friend}.|{friend}, the ball went over there.|I like playing fetch with {friend}.|{friend}, let's have one more throw.",
);
pets(
  ['Hop! Through the hoop!'],
  '{friend}, watch me go through the hoop!|I made it, {friend}!|{friend}, I want to try the next hoop.|Here comes a little jump, {friend}.|{friend}, I can do that again!',
  "{friend}, I'll try this hoop first.|I can get through here, {friend}.|{friend}, I'm taking the course slowly.|One hoop at a time, {friend}.|{friend}, that was a good jump.",
);
pets(
  ['Peekaboo! A little tunnel!'],
  "{friend}, I found a tunnel!|I wonder what's at the other end, {friend}.|{friend}, here I come!|I can see daylight, {friend}.|{friend}, I want to go through again.",
  "{friend}, I'm looking inside the tunnel.|There's a way through here, {friend}.|{friend}, I'll come out the other side.|I like this little passage, {friend}.|{friend}, the tunnel leads back outside.",
);
pets(
  ['What a lovely park!', 'So much to explore!', 'Playtime!'],
  "{friend}, there's so much to do here!|I want to explore the park, {friend}.|{friend}, look at that over there.|I like coming here with {friend}.|{friend}, what shall we try first?",
  "{friend}, I'm having a look around.|This is a nice park, {friend}.|{friend}, I want to stay here for a while.|I'll explore a little way from {friend}.|{friend}, I can watch the other pets play.",
);
pets(
  ['Home sweet home!'],
  "{friend}, I like being at home.|I know this garden, {friend}.|{friend}, this is my favourite place to relax.|I'll have a look around the garden, {friend}.|{friend}, it's good to be home.",
  "{friend}, I've found a quiet spot at home.|I can rest in the garden, {friend}.|{friend}, I'm comfortable here.|I like watching the garden, {friend}.|{friend}, I'll stay near home.",
);
pets(
  ['Walkies? Yes please!', 'Walkies!'],
  "{friend}, are we going out?|I'm ready to go, {friend}!|{friend}, I want to come too.|I've been waiting for this, {friend}.|{friend}, let's get going!",
  "{friend}, I'll come along.|A trip outside sounds nice, {friend}.|{friend}, I'm ready when you are.|I wonder where {friend} will take me.|{friend}, I'll stay nearby.",
);
pets(
  [
    'So many lovely smells!',
    'Sniff, sniff!',
    'Sniff, sniff! Who was here?',
    'Ooh, an interesting smell!',
  ],
  "{friend}, I need to sniff this spot.|Someone has been here, {friend}.|{friend}, there's an interesting smell over here.|Just one more sniff, {friend}.|{friend}, I want to follow that smell.",
  "{friend}, I'm taking my time with this smell.|I found something worth sniffing, {friend}.|{friend}, this spot smells different.|I'll be ready in a moment, {friend}.|{friend}, I wonder who passed this way.",
);
pets(
  ['Bloop! A trip in my bowl!'],
  "{friend}, I can see the town from my bowl.|There's a lot to watch, {friend}.|{friend}, keep my bowl steady.|I like seeing where {friend} takes me.|{friend}, we're going somewhere new.",
  "{friend}, I'm watching the world go by.|I'll swim round while {friend} carries me.|{friend}, I can see people outside my bowl.|A trip with {friend} gives me plenty to look at.|{friend}, I'm coming along in my bowl.",
);
pets(
  ['Hello, new friend!'],
  '{friend}, another pet has come over.|I want to say hello, {friend}.|{friend}, I think we have company.|I wonder if that pet wants to play, {friend}.|{friend}, look who is here.',
  "{friend}, I'll let them come closer.|I'm having a look at our visitor, {friend}.|{friend}, we have met someone.|I can wait while {friend} says hello.|{friend}, I'm happy to stay beside you.",
);
pets(
  [
    'One last sniff, then home!',
    'Home for a cosy rest!',
    'Home for a cuddle!',
    'Feeling cared for!',
  ],
  "{friend}, are we heading home now?|I'm ready to go home, {friend}.|{friend}, I can rest when we get back.|It will be nice to get home with {friend}.|{friend}, I've had a busy day.",
  "{friend}, I could do with a rest at home.|I'll stay close on the way home, {friend}.|{friend}, a quiet evening sounds nice.|I'm looking forward to being home, {friend}.|{friend}, let's get comfortable when we get back.",
);
pets(
  [
    'A little visit to Louise.',
    'Louise will look after me.',
    'Off to see Louise.',
    'Time for a gentle checkup.',
  ],
  "{friend}, are we going to see Louise?|I know Louise will help me, {friend}.|{friend}, will you stay with me at the clinic?|A checkup with Louise, then home with {friend}.|{friend}, I'm coming with you to the vet.",
  "{friend}, Louise can have a look at me.|I feel better with {friend} beside me at the clinic.|{friend}, I'll try to sit still for Louise.|We're going to the clinic, {friend}.|{friend}, I can rest while Louise checks me.",
);
pets(
  ['Nearly our turn!'],
  "{friend}, we're waiting outside the clinic.|There are other pets ahead of us, {friend}.|{friend}, I'll wait here with you.|I can see the clinic door, {friend}.|{friend}, we'll go in when there's room.",
  "{friend}, I can stay beside you in the queue.|We're still waiting, {friend}.|{friend}, someone else is going in first.|I'll watch the door with {friend}.|{friend}, let's wait a little longer.",
);
pets(
  ['Hello, cosy clinic!'],
  "{friend}, we're going into the clinic.|I can see Louise, {friend}.|{friend}, there are other pets here.|I'll come inside with {friend}.|{friend}, this is where Louise works.",
  "{friend}, I'm having a look inside.|I'll stay near {friend} in the clinic.|{friend}, I recognise this place.|We've arrived, {friend}.|{friend}, I can wait here while you check in.",
);
pets(
  ['A little break with my family.'],
  "{friend}, are we coming back later?|I'll come away from the queue with {friend}.|{friend}, we can have a break from waiting.|We're leaving the queue, {friend}.|{friend}, I'll stay with you until our next visit.",
  "{friend}, there are lots of pets waiting today.|I can rest somewhere quieter with {friend}.|{friend}, we can try the clinic later.|I'll come back to see Louise with {friend}.|{friend}, a break sounds good.",
);
pets(
  ['A cosy rest before seeing Louise.'],
  "{friend}, I can rest before we try the clinic again.|We can see Louise later, {friend}.|{friend}, I'll wait at home for now.|A quiet break before our visit, {friend}.|{friend}, let's rest until it's time to go.",
  "{friend}, I'm happy to wait at home.|We still have a visit to make, {friend}.|{friend}, I'll get comfortable until we leave.|A little rest will help me, {friend}.|{friend}, we can try Louise again after this break.",
);

// Rain, street stops and rescues: calm, concrete words, never cheering an injury.
pets(
  ['Wet whiskers! Under that tree!'],
  "{friend}, I don't like getting wet.|It's raining, {friend}. I want to get under that tree.|{friend}, that tree looks drier.|I want to get out of the rain, {friend}.|{friend}, come under the tree with me.",
  "{friend}, I would rather wait somewhere dry.|The rain is getting on me, {friend}.|{friend}, I'm heading for some shelter.|I can wait under the leaves, {friend}.|{friend}, let's get out of this shower.",
);
pets(
  ['Much better. Nice and dry!', 'I will wait with my family.'],
  "{friend}, I'll stay here until the rain stops.|It's drier under this tree, {friend}.|{friend}, I can wait out the shower.|I'm glad {friend} came to wait with me.|{friend}, the leaves are keeping some rain off.",
  "{friend}, this is better than getting wet.|I'll wait beside {friend} under the tree.|{friend}, we can carry on when it's dry.|I'm staying in the shelter with {friend}.|{friend}, I can hear rain on the leaves.",
);
pets(
  ['Sunshine! Off we go!'],
  "{friend}, the rain has stopped!|We can come out now, {friend}.|{friend}, I'm ready to leave the tree.|I want to carry on with {friend}.|{friend}, it's dry enough to go.",
  "{friend}, shall we get going again?|The shower is over, {friend}.|{friend}, I'll come out with you.|We don't need to shelter now, {friend}.|{friend}, I can see the sun again.",
);
pets(
  ['A little toilet break!'],
  "{friend}, I need a toilet break.|Just a moment, {friend}. I need to stop.|{friend}, I can't keep walking just yet.|I'll be ready soon, {friend}.|{friend}, I need a minute here.",
  "{friend}, please wait while I go to the toilet.|I need to stop here, {friend}.|{friend}, this will only take a little while.|A quick toilet stop, then I can walk with {friend}.|{friend}, I'll catch up in a moment.",
);
pets(
  ['All better! Ready to walk!'],
  "{friend}, I'm ready to walk again.|I'll wait while {friend} tidies up.|{friend}, we can carry on soon.|I feel better after that stop, {friend}.|{friend}, let's keep going.",
  "{friend}, I've finished my toilet break.|I'm waiting for {friend} to be ready.|{friend}, there's no rush.|We can go when you're ready, {friend}.|{friend}, I'll stay here while you finish.",
);
pets(
  ['Ooh! What is over there?'],
  "{friend}, I wonder what's down this path.|Something caught my eye, {friend}.|{friend}, I want to look over there.|I've wandered a long way from {friend}.|{friend}, this place is new to me.",
  "{friend}, I don't recognise this spot.|I was following something, {friend}.|{friend}, I've gone further than I meant to.|I wonder which way {friend} went.|{friend}, I should look for the way back.",
);
pets(
  ['Where did everyone go?'],
  "Where is {friend}?|I can't see {friend} from here.|I want to find {friend}.|{friend}, I think I have lost my way.|I wish I knew which way {friend} went.",
  "I need to get back to {friend}.|{friend}, I don't know this part of town.|I'll look around for {friend}.|I hope {friend} comes this way.|{friend}, I'm not sure how to get home.",
);
pets(
  ['I can hear my name!'],
  "I think I can hear {friend}.|Is that {friend} calling me?|{friend}, I'm over here.|I want {friend} to see me.|I'm listening for {friend}.",
  "That sounds like {friend}.|{friend}, can you hear me?|I can hear {friend} nearby.|I hope {friend} looks this way.|{friend}, I'm still here.",
);
pets(
  ['Chirp… a little help down?', 'Meow… this tree is very tall!'],
  "{friend}, I need help getting down.|It's a long way down, {friend}.|{friend}, I'll stay on this branch.|I want {friend} to find me up here.|{friend}, I'm stuck in this tree.",
  "{friend}, I don't want to leave this branch.|I'll wait for help, {friend}.|{friend}, can you see me in the branches?|This tree is higher than I expected, {friend}.|{friend}, I need a safe way down.",
);
pets(
  ['Eek! I need a safe place!'],
  "{friend}, that dog is chasing me.|I need to find somewhere safe, {friend}.|{friend}, I want to get away from that dog.|I wish {friend} were here to help.|{friend}, I don't want to be chased.",
  "{friend}, I'm trying to get out of the way.|That dog is too close, {friend}.|{friend}, I need somewhere to hide.|I want to get back to {friend}.|{friend}, I'm looking for a safe spot.",
);
pets(
  ['Here I am! I will wait.', 'I will wait right here.'],
  "{friend}, I'll wait here.|I can stay still while {friend} comes over.|{friend}, I'm not going anywhere.|I want {friend} to find me in this spot.|{friend}, come this way.",
  "{friend}, I'll stay where you can find me.|I'm waiting for {friend}.|{friend}, I can see you coming.|I'll let {friend} come to me.|{friend}, I'm ready to go with you.",
);
pets(
  ['Flap, flap! Another tree!'],
  "{friend}, I'm flying to that tree.|I can see another branch, {friend}.|{friend}, I've flown a long way.|I wonder where {friend} is from up here.|{friend}, I'm looking for somewhere to land.",
  "{friend}, I'll rest in this tree.|That branch looks like a good perch, {friend}.|{friend}, I need a break from flying.|I'll look for {friend} from this branch.|{friend}, I've found another tree.",
);
pets(
  ['Oops! I got a bit too bouncy!'],
  "{friend}, I got carried away chasing.|I can hear {friend} calling me back.|{friend}, I should leave that pet alone.|I need to stop chasing, {friend}.|{friend}, I'll come back when I can.",
  "{friend}, I was running after that pet.|I should go back to {friend}.|{friend}, that pet doesn't want to play.|I've gone too far from {friend}.|{friend}, I need to slow down.",
);
pets(
  [
    'Help is coming!',
    'Hello, friendly helpers!',
    'Our helpers will find us.',
    'I can hear our helpers!',
  ],
  "{friend}, I can hear someone coming to help.|I hope the helpers can find me, {friend}.|{friend}, I'm waiting for help.|I want to get back to {friend} safely.|{friend}, someone is nearby.",
  "{friend}, I'm listening for the helpers.|I'll stay here until someone reaches me, {friend}.|{friend}, I think help is close now.|I'm glad {friend} called for help.|{friend}, I hope they can see where I am.",
);
pets(
  ['That ladder reaches me!', 'Someone is coming up!'],
  "{friend}, someone is climbing up to me.|I can see the ladder, {friend}.|{friend}, I'll let the firefighter come closer.|Someone is almost here, {friend}.|{friend}, I think I can get down safely now.",
  "{friend}, the firefighter has brought a ladder.|I'll stay on my branch, {friend}.|{friend}, I can see someone coming to get me.|I'm waiting for the firefighter, {friend}.|{friend}, the ladder reaches this branch.",
);
pets(
  ['Safe in friendly arms!', 'Down we go, nice and slow.'],
  "{friend}, the firefighter is carrying me.|I can let someone help me down, {friend}.|{friend}, I'm being held safely.|We're coming down slowly, {friend}.|{friend}, I'll be back with you soon.",
  "{friend}, I\'m safe in the firefighter's arms.|I don\'t have to climb down alone, {friend}.|{friend}, I\'ll keep still while we come down.|The firefighter has got me, {friend}.|{friend}, I can see you waiting below.",
);
pets(
  ['Here I am!'],
  "{friend}, someone is looking for me inside.|I can hear the firefighter, {friend}.|{friend}, I'm waiting to be found.|I hope they look in here, {friend}.|{friend}, I want to get outside.",
  "{friend}, I think the firefighter is close.|I'll let the helper find me, {friend}.|{friend}, I can hear someone in the house.|I'm ready to go outside with help, {friend}.|{friend}, I'll wait in this spot.",
);
pets(
  ['Fresh air! That feels better.'],
  "{friend}, we have made it outside.|The air is clearer out here, {friend}.|{friend}, I'm glad to be out of the house.|I want to stay outside with {friend}.|{friend}, I can have a rest in the fresh air.",
  "{friend}, the firefighter brought me out.|I can see {friend} outside.|{friend}, it's better out here.|I'm safe outside now, {friend}.|{friend}, I need a quiet moment after that.",
);
pets(
  ['A cuddle! I missed you!'],
  "{friend}, I missed you.|I'm glad {friend} found me.|{friend}, please stay close.|I want to go with {friend} now.|{friend}, it's good to be together again.",
  "{friend}, I feel safer with you.|I'm back with {friend} at last.|{friend}, I don't want to wander off again.|I'll stay beside {friend}.|{friend}, I was hoping you would come.",
);
pets(
  [
    'Ouch, my paw needs help.',
    'I need a little help.',
    'A gentle cuddle, please.',
  ],
  "{friend}, I'm sore and need some help.|I want {friend} to stay nearby.|{friend}, please be gentle with me.|Louise can help me, {friend}.|{friend}, I need to rest for a moment.",
  "{friend}, I'm not feeling very well.|I'll wait while {friend} gets help.|{friend}, I would like some care.|I feel safer with {friend} beside me.|{friend}, can we go to the clinic?",
);

// Owners speak to their actual companions, including the pet involved in a rescue.
owners(
  ['What a lovely day.'],
  "It's nice being home with you, {friend}.|{friend}, shall we spend a little time in the garden?|I'll be nearby, {friend}.|{friend}, let's have a quiet moment at home.|We can relax here for a bit, {friend}.",
);
owners(
  ['Ready for a little walk?'],
  "Ready to come out with me, {friend}?|{friend}, let's get ready to go.|Shall we get some fresh air, {friend}?|{friend}, come along. We're going out.|I'm ready when you are, {friend}.",
);
owners(
  ['Off to the park together!', 'What a lovely park.'],
  "Let's have a look around the park, {friend}.|{friend}, there's plenty to do at the park.|We can spend some time at the park, {friend}.|{friend}, shall we see what's happening at the park?|I like visiting the park with you, {friend}.",
);
owners(
  [
    'That was a lovely walk.',
    'Come along, time to go!',
    'Let us get you cosy at home.',
  ],
  "Time to head home, {friend}.|{friend}, let's get home for a rest.|We've had a busy day, {friend}.|{friend}, I'm ready to go home now.|Come along, {friend}. We can relax when we get back.",
);
owners(
  ['Hello! Lovely to see you!', 'Lovely to see you! How are you?'],
  "{friend} and I are out for some fresh air. How are you?|Hello! Have you met {friend}?|It's nice to see you. {friend} came along with me today.|We've stopped to say hello. Come and meet {friend}.|I was just out with {friend}. How has your day been?",
);
owners(
  ['Let us find a nice bench.'],
  "{friend}, let's find somewhere to sit.|There's a bench over there, {friend}.|{friend}, I could do with a short rest.|We can stop by the pond, {friend}.|{friend}, I'll find a place to sit while you explore.",
);
owners(
  ['A peaceful rest by the ducks.'],
  "I can watch the ducks from here, {friend}.|{friend}, this bench is a nice place to rest.|Let's enjoy a quiet moment by the pond, {friend}.|{friend}, I'm happy sitting here for a while.|We picked a peaceful spot, {friend}.",
);
owners(
  ['Time for your checkup.', 'We are on our way, Louise!'],
  "Time to see Louise, {friend}.|{friend}, let's go to the clinic.|I'll come with you to the vet, {friend}.|{friend}, Louise will have a look at you.|We're going to see Louise together, {friend}.",
);
owners(
  ['We will wait safely here.'],
  "We can wait here for a space, {friend}.|{friend}, there are a few pets ahead of us.|Let's stay together in the queue, {friend}.|{friend}, we'll go in when Louise has room.|We're waiting for the clinic, {friend}.",
);
owners(
  ['Hello! Here for our visit.', 'Hello Louise! Here we are.'],
  "Hello, Louise. I have brought {friend} to see you.|Here we\'re, Louise. {friend} came for a visit.|Louise, we\'re here for {friend}'s appointment.|Hello! Can I check in for {friend}?|Good to see you, Louise. We\'re here with {friend}.",
);
owners(
  ['Thank you, Louise!'],
  "Thank you for looking after {friend}, Louise.|We'll take {friend} home now. Thank you, Louise.|Louise, thanks for helping {friend} today.|Time to go home, {friend}. Say goodbye to Louise.|Thank you, Louise. I'm glad you could see {friend}.",
);
owners(
  ['Hmm, it is very busy. We will come back later.'],
  "It's very busy, {friend}. We'll come back later.|Let's take a break, {friend}, and come back later.|{friend}, the queue is long. We can come back later.|We can come back later, {friend}, when there's more room.|{friend}, let's come back later instead of waiting here.",
);
owners(
  ['We will try Louise again a little later.'],
  "We'll try the clinic again soon, {friend}.|{friend}, let's rest before we go back to Louise.|We can wait at home for a bit, {friend}.|{friend}, I have not forgotten your visit to the vet.|We'll see Louise a little later, {friend}.",
);
owners(
  [
    'This looks like a comfy spot.',
    'A lovely place to rest.',
    'A lovely place to wait.',
  ],
  "{friend}, I've found a seat.|We can get comfortable here, {friend}.|{friend}, I'll sit down while we wait.|This looks like a good place to rest, {friend}.|{friend}, I'll be right here on this seat.",
);
owners(
  ['What a welcoming clinic!', 'We will wait right here.'],
  "{friend}, we can wait here together.|I'll stay nearby, {friend}.|{friend}, Louise knows we're here.|We can take our time while we wait, {friend}.|{friend}, I'll let you know when it's our turn.",
);
owners(
  ['Ooh, a lovely story!'],
  "{friend}, I found something to read.|I'll read a little while we wait, {friend}.|{friend}, this book looks interesting.|There's a good story in here, {friend}.|{friend}, I'll finish this page before we go.",
);
owners(
  ['Your turn! This is fun!'],
  "Your turn. I have {friend} for company while we play.|I think that was a good move. What do you think, {friend}?|{friend}, I have time for a game while we wait.|This game is a nice way to pass the time, {friend}.|{friend}, I'm trying to work out my next move.",
);
owners(
  ['Our turn to see Louise!', 'Ready when you are, Louise!'],
  'Our turn now, {friend}.|{friend}, Louise is ready to see us.|Come over to the desk with me, {friend}.|{friend}, we can go in soon.|Ready, {friend}? Louise has called us.',
);
owners(
  ['Come along, little friend.'],
  "Come with me, {friend}. We're following Louise.|{friend}, let's go into the examination room.|This way, {friend}. Louise will show us in.|{friend}, I'm coming into the room with you.|We can go through the door now, {friend}.",
);
owners(
  ['You are in kind hands.'],
  "I'm right here, {friend}. Louise will look after you.|{friend}, we can take this slowly.|Let Louise have a look, {friend}.|{friend}, I'll stay with you during your checkup.|You can rest here while Louise checks you, {friend}.",
);
owners(
  ['Let us find a dry spot.'],
  "{friend}, let's get out of the rain.|We can shelter under that tree, {friend}.|{friend}, I can see a drier spot.|Come over here, {friend}. The leaves will keep some rain off.|{friend}, we'll wait out this shower together.",
);
owners(
  ['We can wait here together.'],
  "{friend}, we can stay here until the rain stops.|It's drier here, {friend}.|{friend}, we don't need to hurry back into the rain.|Let's wait under the tree, {friend}.|{friend}, I'll stay here with you.",
);
owners(
  ['The rain has stopped. Lovely!'],
  "{friend}, the rain has stopped. We can carry on.|Ready to go again, {friend}? The shower is over.|{friend}, it looks dry enough now.|Let's come out from under the tree, {friend}.|{friend}, we can get going again.",
);
owners(
  ['Take your time, little friend.'],
  "Take your time, {friend}. I can wait.|{friend}, we can stop here for a minute.|I'll wait until you're ready, {friend}.|No hurry, {friend}.|{friend}, let me know when you're ready to carry on.",
);
owners(
  ['Bag it up! Keep Hookville tidy.'],
  "Wait a moment, {friend}. I need to pick that up.|{friend}, I have a bag ready to clean up.|Nearly done, {friend}. We'll leave the path tidy.|{friend}, I'm picking up after you.|Stay nearby while I tidy up, {friend}.",
);
owners(
  ['All tidy. Off we go!'],
  "All cleaned up, {friend}. Let's carry on.|{friend}, I've finished tidying up.|Ready to keep walking, {friend}?|{friend}, we can go now.|That's sorted, {friend}. Off we go.",
);
owners(
  ['Wait for me, little friend!'],
  "{friend}, wait for me!|Come back this way, {friend}.|{friend}, you're getting too far away.|Stay where I can see you, {friend}.|{friend}, I'm trying to catch up.",
);
owners(
  ['The police will help me find you.'],
  "I need help finding {friend}.|The police can help me look for {friend}.|I have lost sight of {friend}. I'll ask at the station.|I'll tell the police where I last saw {friend}.|I hope someone has seen {friend}. I'll ask for help.",
);
owners(
  ['We are coming to find you!'],
  "{friend}, we're looking for you.|The officer is helping me find {friend}.|{friend}, I'm calling so you can hear me.|We're checking nearby for {friend}.|{friend}, I hope you can hear us coming.",
);
owners(
  [
    'I can hear the fire engine!',
    'The firefighters are here!',
    'We are safe outside. Help is here!',
  ],
  "{friend}, the firefighters have come to help.|I can hear the fire engine. Help is here for {friend}.|The crew are getting ready to help {friend}.|{friend}, I'll wait where the firefighters can find me.|I'll let the firefighters know where {friend} is.",
);
owners(
  ['Hold on, little friend.', 'Carefully… nearly there!'],
  '{friend}, the firefighter is coming up to you.|Stay on your branch, {friend}. Help is close.|They have brought a ladder for {friend}.|{friend}, wait there. The firefighter is nearly with you.|I can see the firefighter reaching {friend}.',
);
owners(
  ['You have got my little friend!', 'I am right here for you!'],
  "The firefighter has got you, {friend}.|{friend}, they are bringing you down safely.|I'm waiting here for you, {friend}.|{friend}, you don't have to get down on your own.|Thank you for carrying {friend} down carefully.",
);
owners(
  ['They are putting the fire out.'],
  "The firefighters are putting the fire out, {friend}.|{friend}, help is here. I\'ll stay out of the crew's way.|I\'ll let the crew know where to look for {friend}.|The firefighters are helping us, {friend}.|{friend}, the crew are working to make the house safe.",
);
owners(
  ['Please find my little friend.'],
  "Please look inside for {friend}.|{friend} is still in the house. Please help.|The firefighter has gone in to find {friend}.|I'll wait here while the crew look for {friend}.|Please bring {friend} out safely.",
);
owners(
  ['There you are! What a relief!'],
  "There you are, {friend}. I'm so glad to see you.|Thank you for bringing {friend} outside.|{friend}, I'm relieved you're out of the house.|I can see {friend}. Thank you for finding them.|{friend}, stay out here with me now.",
);
owners(
  ['Safe again! Let us see Louise.'],
  "{friend}, I'm so glad we found you.|You're back with me now, {friend}. Let's see Louise.|{friend}, I missed you. We'll get you checked over.|Stay close, {friend}. We'll go to the clinic together.|{friend}, Louise can make sure you're all right.",
);
owners(
  ['Thank you, lovely helpers!', 'Thank you for helping us!'],
  "Thank you for helping {friend}.|We'll take {friend} to Louise now. Thank you.|{friend}, the helpers have looked after us well.|I'm grateful you found {friend}.|Thank you. I'll make sure Louise checks {friend}.",
);
owners(
  ['Someone has stopped to help.', 'Stay with me. Help is coming.'],
  "{friend}, someone has stopped to help you.|I'm getting help for {friend}.|{friend}, stay there. We'll help you.|We need to get {friend} to the clinic.|{friend}, I'll make sure you get some care.",
);
owners(
  ['I am coming, little friend!'],
  "{friend}, I'm coming over to you.|I'm on my way to {friend}.|Wait there, {friend}. I'll come and get you.|{friend}, I know where you are now.|I'll be there soon, {friend}.",
);
owners(
  ['I have you. Louise can help.'],
  "{friend}, I've got you. Let's see Louise.|I'll carry you carefully, {friend}.|{friend}, we're going to get you some help.|You can rest while I take you to Louise, {friend}.|{friend}, I'll be gentle with you.",
);
owners(
  ['Come back! Gentle play, please.'],
  "{friend}, come back. Leave that pet alone.|That's enough chasing, {friend}.|{friend}, the other pet doesn't want to be chased.|Come here, {friend}. We'll carry on together.|{friend}, stop and come back to me.",
);
owners(
  ['Hello, little friend!'],
  "Hello! Let's see how you're feeling today.|Come in and get comfortable. I'm here to help.|We can take our time with your checkup.|Hello! I'm glad you came to see me.|Let's find out what will help you feel better.",
);
