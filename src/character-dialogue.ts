/** Complete, context-specific lines. Only {friend} is substituted with a name.
 * The keys are existing activity labels, never prefixes added to the dialogue.
 * Pet banks form a pool of internal thoughts; each pet has its own selection.
 * Owner references in thoughts are third-person and relevant to the situation.
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
  'That feels good.|I found a good scratching spot.|One more scratch.|I can really stretch here.|This post is just right.',
  'I could scratch here all day.|This is better than the sofa.|A good scratch, then a rest.|I like this scratching post.|My claws needed that.',
);
pets(
  ['Little legs, go go go!'],
  'Look how fast I can go!|I want another turn on the wheel.|The wheel keeps going round!|A bit more running, then a rest.|This is a good place to run.',
  "I'm getting the hang of this.|I like running at my own speed.|I can stop for a rest when I want.|One more run!|It's fun making the wheel turn.",
);
pets(
  ['Whee! Round we go!', 'Whee!'],
  'Whee! Round I go!|Here comes that corner again.|I want another ride!|Everything keeps going past.|I like going round on this ride.',
  "Another lap!|This is a lovely slow ride.|One more time round.|I'll get off when the ride stops.|I like this little seat.",
);
pets(
  ['Wheee! Here comes the hill!'],
  'Wheee! Here comes the hill!|Up we go!|I want to ride the coaster again!|Everything looks small down there.|Here comes the fun bit!',
  "That hill made my tummy tickle.|I'll have a rest when the coaster stops.|I liked that little hill.|Another turn would be fun.|The next corner is coming up!",
);
pets(
  ['Wow! I can see my house!'],
  "Look how high I am!|I can see over the fence.|Everything looks smaller from here.|What a view!|It's quiet up here.",
  "I can watch the town from here.|The wheel is taking me up slowly.|I'll be back down soon.|I like this view.|I wonder what I can see from the top.",
);
pets(
  ['Ooh! My favourite toy!', 'Come back, bouncy ball!'],
  'I want to try that toy.|This one looks fun!|I found something to play with.|One more game.|I like this toy!',
  "I picked a good one.|I wonder what this toy does.|I could play here for ages.|I'll have a go with this one.|There's another toy over there.",
);
pets(
  ['Mmm, yummy!', 'Yum! Crunchy doggy treats!'],
  'These treats are crunchy!|I like these dog treats.|I found a tasty snack.|One more crunch.|That was a good treat.',
  "I'll take my time with this one.|These dog treats smell good.|There's a snack here for me.|This is tasty!|I like the crunchy bits.",
);
pets(
  ['Purrr… tasty kitty nibbles!'],
  'These cat treats smell good.|I like these little nibbles.|This is a tasty treat.|I hope there are more of these next time.|I found my snack.',
  "I'll eat these treats slowly.|These nibbles are just right.|I like this little snack.|I can smell the treats from here.|Those treats were worth waiting for.",
);
pets(
  ['Chirp! Lovely little seeds!'],
  'I found some seeds.|These little seeds are tasty.|I like picking out the seeds.|Just a few more seeds.|This is a good snack.',
  "I'm busy with these seeds.|I like this seed mix.|There are little seeds here for me.|I'll finish this seed first.|That was a tasty beakful.",
);
pets(
  ['Nibble, nibble! Yummy greens!'],
  'These greens are crunchy.|I like these leaves.|I found a leafy snack.|One more nibble.|These greens taste good.',
  "I'll take little bites.|These leaves smell fresh.|I could nibble here for a while.|I like having greens for a snack.|I'll finish this leaf first.",
);
pets(
  ['Mmm! A snack for my cheeks!'],
  'I can tuck this snack in my cheeks.|A little nibble now.|I found something crunchy.|I can save some of this for later.|My cheeks have room for a snack.',
  "This snack fits in my paws.|I like taking tiny bites.|I have a bit saved in my cheeks.|Time for a quiet snack.|I'm busy nibbling.",
);
pets(
  ['Crunch! Tasty little grains!'],
  'I found some crunchy grains.|These little grains taste good.|I can hold this snack in my paws.|Just a few more nibbles.|I like this grain mix.',
  "I'll choose a grain to nibble.|This is a good little snack.|I'll eat this bit slowly.|I like the crunchy grains.|There's a snack here just for me.",
);
pets(
  ['Bloop! Delicious fish flakes!'],
  "The fish flakes are floating down.|I can see my food.|I'll swim up for a flake.|These flakes taste good.|I found another little flake.",
  "It's feeding time.|I like catching the sinking flakes.|There's a flake over here.|I'll swim over to my food.|That was a tasty fish flake.",
);
pets(
  ['Ahh! A cool drink!'],
  'I needed a drink.|This water is cool.|I found the water bowl.|A drink, then more playing.|I feel better after that water.',
  "Time to stop for some water.|A quiet drink is nice.|There's fresh water here.|I'll finish my drink first.|That water was just what I wanted.",
);
pets(
  ['Pop! Got that bubble!'],
  'I caught a bubble!|There goes another one!|It popped before I could catch it.|I want to chase that big bubble.|Look at all these bubbles!',
  "A bubble landed beside me.|I like watching the bubbles float past.|That bubble is coming this way.|I'll try to catch the next one.|The bubbles keep disappearing!",
);
pets(
  [
    'So cosy… purrr…',
    'Purrr… cosy dreams.',
    'Zzz… lovely dreams.',
    'A quiet rest.',
  ],
  "I'll rest here for a bit.|This is a comfy spot.|I'm ready for a nap.|I can relax here.|I might close my eyes for a while.",
  "It's nice and quiet here.|A little sleep sounds good.|I've found somewhere to settle down.|I could get comfortable here.|Just a few more minutes of rest.",
);
pets(
  ['Chirp! What a pretty tune!'],
  'I like that tinkling sound.|The chimes moved when I landed.|I want to hear the chimes again.|I can make a sound too!|The chimes sound lovely.',
  "I'll listen from this perch.|I wonder which chime will ring next.|I like hearing a little music.|That was a pretty sound.|The next chime sounds different.",
);
pets(
  ['Pounce! Silly wiggly yarn!', 'Flutter, flutter! Pounce!'],
  "I'm going to catch it!|It moved again!|Ready to pounce.|I nearly had it that time.|One more try!",
  "I'll wait for it to move.|I can reach it from here.|This is a good pouncing spot.|I'll watch it for a moment.|I caught it that time.",
);
pets(
  ['Flap, flap! Lovely space!', 'Flap, flap! Out with my family!'],
  "There's room to fly here!|I can stretch my wings.|I'll fly over there.|I like having room to turn.|I'll fly back in a moment.",
  "I'm heading for that perch.|A short flight, then a rest.|I can see a lot from up here.|I like having space for my wings.|Time to fly back over.",
);
pets(
  ['My lovely leafy lookout!', 'Chirp! What a view!'],
  'I like my new perch.|I can see a lot from here.|I found a branch to rest on.|This is a good lookout.|I like it up in the leaves.',
  "It's peaceful on this branch.|I can watch from here.|I picked a shady perch.|I'll stay on this branch for a bit.|I can see the path from here.",
);
pets(
  ['My turn soon!'],
  "I'm waiting for a turn.|I hope it's my turn next.|I'll wait behind this pet.|I want to try that too.|The queue is moving.",
  "I can watch while I wait.|I'll have a go when there's room.|Someone else is using it now.|I'm staying in the queue.|I can wait a little longer.",
);
pets(
  ['All aboard!'],
  "It's my turn now!|Here I go!|There's room for me now.|I'm getting ready for my turn.|Time to have a go!",
  "I'll get settled first.|My turn has come.|I'm ready to try this.|I can start now.|I'll try it slowly.",
);
pets(
  ['Ooh! Let us try this!'],
  "I want to try that.|There's something to play with!|I'll go and have a look.|I wonder what that does.|I want to go over there.",
  "That looks interesting.|I'll take a closer look.|I might have a go at that.|I want to see what's over there.|I'll find something to do.",
);
pets(
  ['Happy to wait with you.'],
  "I'll wait here for a bit.|It's nice having company.|I can stay here for a while.|This is a good place to wait.|I'm comfortable here.",
  "I can rest until it's our turn.|I don't mind a quiet break.|There's plenty to watch while I wait.|I'll get settled here.|I'm happy waiting nearby.",
);

// Park, home and ordinary journeys.
pets(
  ['Throw it again! Again!'],
  "I want another throw!|I'm bringing it back!|That was a good throw.|I found the ball!|I'm ready for another throw.",
  "I'll fetch that ball.|I've got it.|The ball went over there.|I like playing fetch with {friend}.|One more game of fetch would be nice.",
);
pets(
  ['Hop! Through the hoop!'],
  'I can make it through that hoop!|I made it!|I want to try the next hoop.|Here comes a little jump.|I can do that again!',
  "I'll try this hoop first.|I can get through here.|I'm taking the course slowly.|One hoop at a time.|That was a good jump.",
);
pets(
  ['Peekaboo! A little tunnel!'],
  "I found a tunnel!|I wonder what's at the other end.|Here I come!|I can see daylight.|I want to go through again.",
  "I'm looking inside the tunnel.|There's a way through here.|I'll come out the other side.|I like this little passage.|The tunnel leads back outside.",
);
pets(
  ['What a lovely park!', 'So much to explore!', 'Playtime!'],
  "There's so much to do here!|I want to explore the park.|Something over there caught my eye.|I like coming here with {friend}.|What should I try first?",
  "I'm having a look around.|This is a nice park.|I want to stay here for a while.|I'll explore a little way from {friend}.|I can watch the other pets play.",
);
pets(
  ['Home sweet home!'],
  "I like being at home.|I know this garden.|This is my favourite place to relax.|I'll have a look around the garden.|It's good to be home.",
  "I've found a quiet spot at home.|I can rest in the garden.|I'm comfortable here.|I like watching the garden.|I'll stay near home.",
);
pets(
  ['Walkies? Yes please!', 'Walkies!'],
  "Are we going out?|I'm ready to go!|I want to come too.|I've been waiting for this.|I hope we're leaving soon!",
  "I'll come along.|A trip outside sounds nice.|I'm ready for an outing.|I wonder where {friend} will take me.|I'll stay nearby.",
);
pets(
  [
    'So many lovely smells!',
    'Sniff, sniff!',
    'Sniff, sniff! Who was here?',
    'Ooh, an interesting smell!',
  ],
  "I need to sniff this spot.|Someone has been here.|There's an interesting smell over here.|Just one more sniff.|I want to follow that smell.",
  "I'm taking my time with this smell.|I found something worth sniffing.|This spot smells different.|I'll be ready in a moment.|I wonder who passed this way.",
);
pets(
  ['Bloop! A trip in my bowl!'],
  "I can see the town from my bowl.|There's a lot to watch.|I hope my bowl stays steady.|I like seeing where {friend} takes me.|We're going somewhere new.",
  "I'm watching the world go by.|I'll swim round while {friend} carries me.|I can see people outside my bowl.|A trip with {friend} gives me plenty to look at.|I'm coming along in my bowl.",
);
pets(
  ['Hello, new friend!'],
  'Another pet has come over.|I want to say hello.|I think we have company.|I wonder if that pet wants to play.|Someone has come to say hello.',
  "I'll let them come closer.|I'm having a look at our visitor.|We have met someone.|I can wait while {friend} says hello.|I'm happy staying nearby.",
);
pets(
  [
    'One last sniff, then home!',
    'Home for a cosy rest!',
    'Home for a cuddle!',
    'Feeling cared for!',
  ],
  "Are we heading home now?|I'm ready to go home.|I can rest when we get back.|It will be nice to get home with {friend}.|I've had a busy day.",
  "I could do with a rest at home.|I'll stay close on the way home.|A quiet evening sounds nice.|I'm looking forward to being home.|I want to rest when we get back.",
);
pets(
  [
    'A little visit to Louise.',
    'Louise will look after me.',
    'Off to see Louise.',
    'Time for a gentle checkup.',
  ],
  "Are we going to see Louise?|I know Louise will help me.|I hope {friend} stays with me at the clinic.|A checkup with Louise, then home with {friend}.|I'll go with {friend} to the vet.",
  "Louise can have a look at me.|I feel better with {friend} beside me at the clinic.|I'll try to sit still for Louise.|We're going to the clinic.|I can rest while Louise checks me.",
);
pets(
  ['Nearly our turn!'],
  "We're waiting outside the clinic.|There are other pets ahead of us.|I'll wait here for a space.|I can see the clinic door.|We'll go in when there's room.",
  "I can stay nearby in the queue.|We're still waiting.|Someone else is going in first.|I'll watch the door with {friend}.|I can wait a little longer outside.",
);
pets(
  ['Hello, cosy clinic!'],
  "We're going into the clinic.|I can see Louise.|There are other pets here.|I'll have a look inside.|This is where Louise works.",
  "I wonder where we'll sit.|I'll stay nearby while we check in.|I recognise this place.|We've arrived.|I can wait here for a moment.",
);
pets(
  ['A little break with my family.'],
  "Are we coming back later?|I'll come away from the queue with {friend}.|We can have a break from waiting.|We're leaving the queue.|I'll stay with {friend} until our next visit.",
  "There are lots of pets waiting today.|I can rest somewhere quieter with {friend}.|We can try the clinic later.|I'll come back to see Louise with {friend}.|A break sounds good.",
);
pets(
  ['A cosy rest before seeing Louise.'],
  "I can rest before we try the clinic again.|We can see Louise later.|I'll wait at home for now.|A quiet break before our visit.|I'll rest until it's time to go.",
  "I'm happy to wait at home.|We still have a visit to make.|I'll get comfortable until we leave.|A little rest will help me.|We can try Louise again after this break.",
);

// Rain, street stops and rescues: calm, concrete words, never cheering an injury.
pets(
  ['Wet whiskers! Under that tree!'],
  "I don't like getting wet.|It's raining. I want to get under that tree.|That tree looks drier.|I want to get out of the rain.|I hope my family follows me under the tree.",
  "I would rather wait somewhere dry.|The rain is getting on me.|I'm heading for some shelter.|I can wait under the leaves.|I want to get out of this shower.",
);
pets(
  ['Much better. Nice and dry!', 'I will wait with my family.'],
  "I'll stay here until the rain stops.|It's drier under this tree.|I can wait out the shower.|I'm glad {friend} came to wait with me.|The leaves are keeping some rain off.",
  "This is better than getting wet.|I'll wait beside {friend} under the tree.|We can carry on when it's dry.|I'm staying in the shelter with {friend}.|I can hear rain on the leaves.",
);
pets(
  ['Sunshine! Off we go!'],
  "The rain has stopped!|We can come out now.|I'm ready to leave the tree.|I want to carry on with {friend}.|It's dry enough to go.",
  "I can start exploring again.|The shower is over.|I'll come out with {friend}.|We don't need to shelter now.|I can see the sun again.",
);
pets(
  ['A little toilet break!'],
  "I need a toilet break.|Just a moment. I need to stop.|I can't keep walking just yet.|I'll be ready soon.|I need a minute here.",
  "I need a minute for the toilet.|I need to stop here.|This will only take a little while.|A quick toilet stop, then I can walk with {friend}.|I'll catch up in a moment.",
);
pets(
  ['All better! Ready to walk!'],
  "I'm ready to walk again.|I'll wait while {friend} tidies up.|We can carry on soon.|I feel better after that stop.|I want to keep walking.",
  "I've finished my toilet break.|I'm waiting for {friend} to be ready.|There's no rush.|We can go when {friend} is ready.|I'll stay here while {friend} finishes.",
);
pets(
  ['Ooh! What is over there?'],
  "I wonder what's down this path.|Something caught my eye.|I want to look over there.|I've wandered a long way from {friend}.|This place is new to me.",
  "I don't recognise this spot.|I was following something.|I've gone further than I meant to.|I wonder which way {friend} went.|I should look for the way back.",
);
pets(
  ['Where did everyone go?'],
  "Where is {friend}?|I can't see {friend} from here.|I want to find {friend}.|I think I have lost my way.|I wish I knew which way {friend} went.",
  "I need to get back to {friend}.|I don't know this part of town.|I'll look around for {friend}.|I hope {friend} comes this way.|I'm not sure how to get home.",
);
pets(
  ['I can hear my name!'],
  "I think I can hear {friend}.|Is that {friend} calling me?|I'm over here.|I want {friend} to see me.|I'm listening for {friend}.",
  "That sounds like {friend}.|I hope {friend} can hear me.|I can hear {friend} nearby.|I hope {friend} looks this way.|I'm still here.",
);
pets(
  ['Chirp… a little help down?', 'Meow… this tree is very tall!'],
  "I need help getting down.|It's a long way down.|I'll stay on this branch.|I want {friend} to find me up here.|I'm stuck in this tree.",
  "I don't want to leave this branch.|I'll wait for help.|I hope {friend} can see me in the branches.|This tree is higher than I expected.|I need a safe way down.",
);
pets(
  ['Eek! I need a safe place!'],
  "That dog is chasing me.|I need to find somewhere safe.|I want to get away from that dog.|I wish {friend} were here to help.|I don't want to be chased.",
  "I'm trying to get out of the way.|That dog is too close.|I need somewhere to hide.|I want to get back to {friend}.|I'm looking for a safe spot.",
);
pets(
  ['Here I am! I will wait.', 'I will wait right here.'],
  "I'll wait here.|I can stay still while {friend} comes over.|I'm not going anywhere.|I want {friend} to find me in this spot.|I'll stay where I am.",
  "I'll stay where {friend} can find me.|I'm waiting for {friend}.|I can see {friend} coming.|I'll let {friend} come to me.|I'm ready to go home.",
);
pets(
  ['Flap, flap! Another tree!'],
  "I'm flying to that tree.|I can see another branch.|I've flown a long way.|I wonder where {friend} is from up here.|I'm looking for somewhere to land.",
  "I'll rest in this tree.|That branch looks like a good perch.|I need a break from flying.|I'll look for {friend} from this branch.|I've found another tree.",
);
pets(
  ['Oops! I got a bit too bouncy!'],
  "I got carried away chasing.|I can hear {friend} calling me back.|I should leave that pet alone.|I need to stop chasing.|I'll come back when I can.",
  "I was running after that pet.|I should go back to {friend}.|That pet doesn't want to play.|I've gone too far from {friend}.|I need to slow down.",
);
pets(
  [
    'Help is coming!',
    'Hello, friendly helpers!',
    'Our helpers will find us.',
    'I can hear our helpers!',
  ],
  "I can hear someone coming to help.|I hope the helpers can find me.|I'm waiting for help.|I want to get back to {friend} safely.|Someone is nearby.",
  "I'm listening for the helpers.|I'll stay here until someone reaches me.|I think help is close now.|I'm glad {friend} called for help.|I hope they can see where I am.",
);
pets(
  ['That ladder reaches me!', 'Someone is coming up!'],
  "Someone is climbing up to me.|I can see the ladder.|I'll let the firefighter come closer.|Someone is almost here.|I think I can get down safely now.",
  "The firefighter has brought a ladder.|I'll stay on my branch.|I can see someone coming to get me.|I'm waiting for the firefighter.|The ladder reaches this branch.",
);
pets(
  ['Safe in friendly arms!', 'Down we go, nice and slow.'],
  "The firefighter is carrying me.|I can let someone help me down.|I'm being held safely.|We're coming down slowly.|I'll be back with {friend} soon.",
  "I'm safe in the firefighter's arms.|I don't have to climb down alone.|I'll keep still while we come down.|The firefighter has got me.|I can see {friend} waiting below.",
);
pets(
  ['Here I am!'],
  "Someone is looking for me inside.|I can hear the firefighter.|I'm waiting to be found.|I hope they look in here.|I want to get outside.",
  "I think the firefighter is close.|I'll let the helper find me.|I can hear someone in the house.|I'm ready to go outside with help.|I'll wait in this spot.",
);
pets(
  ['Fresh air! That feels better.'],
  "We have made it outside.|The air is clearer out here.|I'm glad to be out of the house.|I want to stay outside with {friend}.|I can have a rest in the fresh air.",
  "The firefighter brought me out.|I can see {friend} outside.|It's better out here.|I'm safe outside now.|I need a quiet moment after that.",
);
pets(
  ['A cuddle! I missed you!'],
  "I missed {friend}.|I'm glad {friend} found me.|I want {friend} nearby.|I want to go with {friend} now.|It's good to be together again.",
  "I feel safer with {friend}.|I'm back with {friend} at last.|I don't want to wander off again.|I'll stay beside {friend}.|I was hoping {friend} would come.",
);
pets(
  [
    'Ouch, my paw needs help.',
    'I need a little help.',
    'A gentle cuddle, please.',
  ],
  "I'm sore and need some help.|I want {friend} to stay nearby.|I hope Louise will be gentle with me.|Louise can help me.|I need to rest for a moment.",
  "I'm not feeling very well.|I'll wait while {friend} gets help.|I would like some care.|I feel safer with {friend} beside me.|I want to go to the clinic.",
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

pets(
  ['fish-bubbles'],
  'A bubble tickled my fin.|I can swim beside these bubbles.|Up they go!|This water feels lovely.|I like the tiny bubbles.',
  'That bubble went past my nose.|There is room to turn around.|I will follow this little bubble.|My fins feel floaty.|One more swim through the bubbles.',
);
pets(
  ['fish-reef'],
  'I can see through that hoop.|The coral has lovely colours.|I will swim around again.|There is a little arch to explore.|That looks like a good hiding place.',
  'I like watching the reef.|Here comes the hoop again.|I can turn beside the coral.|A peaceful little swim.|There is something new to look at.',
);
pets(
  ['agility-tunnel'],
  'I can see the other end!|Through the tunnel I go.|That was a good run.|I want to try it again.|The stripes go all the way through.',
  'Here I come!|There is plenty of room in here.|Out the other side!|I can take my time.|Back through the tunnel.',
);
pets(
  ['snuffle-mat'],
  'I can smell a little snack.|Something is hiding in this tuft.|My nose found it!|This mat feels soft.|I will check this corner.',
  'There is another lovely smell.|A little sniff over here.|Found a tasty nibble!|This is a good searching spot.|I like finding things with my nose.',
);
pets(
  ['cat-feather'],
  'I am watching that feather.|Wait for it… pounce!|It moved again!|I nearly caught it.|A little bat with my paw.',
  'That feather is coming back.|I can reach it from here.|I will crouch and wait.|Got it for a moment!|One more little pounce.',
);
pets(
  ['dig-box'],
  'This bedding is lovely and soft.|I can dig a little hollow.|There is something under here.|A cosy little burrow.|My paws are busy.',
  'I will dig in this corner.|A little pile for me.|This is a good exploring box.|I found the tunnel!|Time to peep out again.',
);
pets(
  ['bird-hoops'],
  'I can fly through that hoop.|There is room for my wings.|Through the blue one!|I will fly back to the perch.|That was a lovely little flight.',
  'My wings are feeling busy.|Here comes the next hoop.|I can see my landing place.|Another turn through the course.|A little rest, then more flying.',
);
pets(
  ['pet-piano'],
  'That key lit up!|I made a little tune.|What happens on this key?|The colours follow my taps.|I will try the next one.',
  'A soft tap makes it light up.|This is my favourite key.|I can make a little pattern.|Another colourful note.|I like playing this little piano.',
);
