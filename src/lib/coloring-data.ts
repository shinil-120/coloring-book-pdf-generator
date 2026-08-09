// Coloring Book Data: categories, items, and natural color palettes
// Each item has a palette of RGB colors used for auto-colorization.
// The largest enclosed region → palette[0], second largest → palette[1], etc.

export type RGB = [number, number, number];
export type Palette = RGB[];

export interface ColoringBook {
  name: string;        // e.g. "Dinosaurs Coloring Book"
  slug: string;        // e.g. "dinosaurs"
  category: string;    // e.g. "Dinosaurs"
  items: string[];     // 30 items per book
  description: string; // shown in UI
}

export interface ColoringBookMeta {
  name: string;
  url: string;          // /downloads/{Slug}-Coloring-Book.pdf
  slug: string;
  size: string;         // e.g. "1.4 MB"
  sizeBytes: number;
  pages: number;
  category: string;
  timestamp: string;    // ISO
  readableTime: string; // human-readable UTC
  description: string;
  items?: string[];     // item labels for the editor (1:1 with pages)
}

// ---------------------------------------------------------------------------
// CATEGORY SUFFIX used in image-generation prompts.
// "Kiwi" in a fruits book → "kiwi fruit", not "kiwi bird".
// ---------------------------------------------------------------------------
const CATEGORY_SUFFIX: Record<string, string> = {
  Dinosaurs: "dinosaur",
  Dragons: "dragon",
  "Ocean Animals": "ocean animal",
  Vehicles: "vehicle",
  Flowers: "flower",
  Insects: "insect",
  "Wild Animals": "wild animal",
  "Fantasy Creatures": "fantasy creature",
  Space: "space object",
  "Food & Sweets": "food",
  Pets: "pet",
};

export function categorySuffix(category: string): string {
  return CATEGORY_SUFFIX[category] ?? category.toLowerCase();
}

// ---------------------------------------------------------------------------
// THE 10 BOOKS — each with 30 items (in the exact order they appear in spec).
// ---------------------------------------------------------------------------
export const BOOKS: ColoringBook[] = [
  {
    name: "Dinosaurs Coloring Book",
    slug: "Dinosaurs",
    category: "Dinosaurs",
    description: "30 pages — no covers, no blanks",
    items: [
      "T-Rex", "Triceratops", "Stegosaurus", "Brachiosaurus", "Velociraptor",
      "Pterodactyl", "Ankylosaurus", "Diplodocus", "Spinosaurus", "Parasaurolophus",
      "Iguanodon", "Allosaurus", "Brontosaurus", "Ceratosaurus", "Compsognathus",
      "Deinonychus", "Gallimimus", "Hadrosaurus", "Kentrosaurus", "Lambeosaurus",
      "Maiasaura", "Oviraptor", "Pachycephalosaurus", "Protoceratops", "Styracosaurus",
      "Therizinosaurus", "Utahraptor", "Archaeopteryx", "Saichania", "Dilophosaurus",
    ],
  },
  {
    name: "Dragons Coloring Book",
    slug: "Dragons",
    category: "Dragons",
    description: "30 pages — no covers, no blanks",
    items: [
      "Fire Dragon", "Ice Dragon", "Water Dragon", "Earth Dragon", "Wind Dragon",
      "Crystal Dragon", "Shadow Dragon", "Light Dragon", "Thunder Dragon", "Forest Dragon",
      "Moon Dragon", "Sun Dragon", "Star Dragon", "Cloud Dragon", "Mountain Dragon",
      "Ocean Dragon", "Volcano Dragon", "Storm Dragon", "Gold Dragon", "Silver Dragon",
      "Bronze Dragon", "Copper Dragon", "Jade Dragon", "Ruby Dragon", "Sapphire Dragon",
      "Emerald Dragon", "Amethyst Dragon", "Phoenix Dragon", "Desert Dragon", "Nature Dragon",
    ],
  },
  {
    name: "Ocean Animals Coloring Book",
    slug: "Ocean-Animals",
    category: "Ocean Animals",
    description: "30 pages — no covers, no blanks",
    items: [
      "Whale", "Shark", "Dolphin", "Octopus", "Turtle",
      "Crab", "Starfish", "Seahorse", "Jellyfish", "Lobster",
      "Shrimp", "Squid", "Eel", "Stingray", "Pufferfish",
      "Clownfish", "Angelfish", "Swordfish", "Seal", "Walrus",
      "Penguin", "Sea Otter", "Manatee", "Hermit Crab", "Sea Urchin",
      "Coral", "Sea Anemone", "Manta Ray", "Orca", "Moray Eel",
    ],
  },
  {
    name: "Vehicles Coloring Book",
    slug: "Vehicles",
    category: "Vehicles",
    description: "30 pages — no covers, no blanks",
    items: [
      "Car", "Truck", "Bus", "Motorcycle", "Airplane",
      "Helicopter", "Train", "Submarine", "Rocket", "Tractor",
      "Bicycle", "Scooter", "Ambulance", "Fire Truck", "Police Car",
      "Taxi", "Van", "Pickup Truck", "Dump Truck", "Excavator",
      "Bulldozer", "Crane", "Forklift", "Sailboat", "Speedboat",
      "Hot Air Balloon", "Glider", "Cable Car", "Monorail", "Tractor Trailer",
    ],
  },
  {
    name: "Flowers Coloring Book",
    slug: "Flowers",
    category: "Flowers",
    description: "30 pages — no covers, no blanks",
    items: [
      "Rose", "Sunflower", "Tulip", "Daisy", "Lily",
      "Orchid", "Lotus", "Lavender", "Poppy", "Marigold",
      "Daffodil", "Hibiscus", "Jasmine", "Peony", "Chrysanthemum",
      "Carnation", "Iris", "Violet", "Dandelion", "Bluebell",
      "Snowdrop", "Crocus", "Azalea", "Camellia", "Magnolia",
      "Plumeria", "Zinnia", "Cosmos", "Snapdragon", "Forget Me Not",
    ],
  },
  {
    name: "Insects Coloring Book",
    slug: "Insects",
    category: "Insects",
    description: "30 pages — no covers, no blanks",
    items: [
      "Butterfly", "Bee", "Ladybug", "Ant", "Dragonfly",
      "Grasshopper", "Beetle", "Caterpillar", "Moth", "Spider",
      "Centipede", "Cicada", "Cricket", "Firefly", "Wasp",
      "Hornet", "Praying Mantis", "Stick Insect", "Leaf Insect", "Snail",
      "Worm", "Mosquito", "Fly", "Termite", "Mayfly",
      "Damselfly", "Stink Bug", "Walking Stick", "Honey Bee", "Bumblebee",
    ],
  },
  {
    name: "Wild Animals Coloring Book",
    slug: "Wild-Animals",
    category: "Wild Animals",
    description: "30 pages — no covers, no blanks",
    items: [
      "Lion", "Tiger", "Elephant", "Giraffe", "Zebra",
      "Bear", "Monkey", "Kangaroo", "Hippo", "Rhino",
      "Cheetah", "Leopard", "Panther", "Wolf", "Fox",
      "Deer", "Moose", "Bison", "Camel", "Llama",
      "Panda", "Koala", "Sloth", "Anteater", "Armadillo",
      "Porcupine", "Beaver", "Raccoon", "Skunk", "Gorilla",
    ],
  },
  {
    name: "Fantasy Creatures Coloring Book",
    slug: "Fantasy-Creatures",
    category: "Fantasy Creatures",
    description: "30 pages — no covers, no blanks",
    items: [
      "Unicorn", "Mermaid", "Fairy", "Wizard", "Gnome",
      "Troll", "Elf", "Dwarf", "Griffin", "Phoenix",
      "Centaur", "Minotaur", "Cyclops", "Goblin", "Ogre",
      "Pixie", "Sprite", "Nymph", "Dryad", "Banshee",
      "Kraken", "Leviathan", "Chimera", "Hydra", "Basilisk",
      "Cockatrice", "Manticore", "Sphinx", "Pegasus", "Siren",
    ],
  },
  {
    name: "Space Coloring Book",
    slug: "Space",
    category: "Space",
    description: "30 pages — no covers, no blanks",
    items: [
      "Sun", "Mercury", "Venus", "Earth", "Mars",
      "Jupiter", "Saturn", "Uranus", "Neptune", "Moon",
      "Comet", "Asteroid", "Meteor", "Rocket", "Astronaut",
      "Space Shuttle", "Satellite", "Space Station", "Telescope", "Galaxy",
      "Nebula", "Black Hole", "Supernova", "Northern Lights", "Solar Eclipse",
      "Lunar Eclipse", "Constellation", "Dwarf Planet", "Quasar", "Pulsar",
    ],
  },
  {
    name: "Food & Sweets Coloring Book",
    slug: "Food-Sweets",
    category: "Food & Sweets",
    description: "30 pages — no covers, no blanks",
    items: [
      "Ice Cream", "Cake", "Donut", "Cupcake", "Pizza",
      "Burger", "Hot Dog", "Sandwich", "Taco", "Sushi",
      "Cookie", "Brownie", "Pie", "Muffin", "Croissant",
      "Bagel", "Pancake", "Waffle", "Chocolate", "Lollipop",
      "Candy", "Cotton Candy", "Popsicle", "Apple Pie", "Cheesecake",
      "Pretzel", "Popcorn", "Nachos", "Smoothie", "Milkshake",
    ],
  },
  {
    name: "Pets Coloring Book",
    slug: "Pets",
    category: "Pets",
    description: "30 pages — no covers, no blanks",
    items: [
      "Dog", "Cat", "Hamster", "Rabbit", "Parrot",
      "Goldfish", "Guinea Pig", "Ferret", "Turtle", "Chinchilla",
      "Gerbil", "Mouse", "Canary", "Budgie", "Cockatiel",
      "Bearded Dragon", "Corn Snake", "Leopard Gecko", "Betta Fish", "Koi Fish",
      "Hedgehog", "Sugar Glider", "Pot-Bellied Pig", "Mini Goat", "Chick",
      "Duckling", "Tarantula", "Snail", "Iguana", "Finch",
    ],
  },
];

// ---------------------------------------------------------------------------
// NATURAL COLOR PALETTES — keyed by item name.
// Largest enclosed region → palette[0], second → palette[1], etc.
// ---------------------------------------------------------------------------
export const NATURAL_PALETTES: Record<string, Palette> = {
  // ---- Fruits (inside Food & Sweets category, but palette applies by name) ----
  Apple: [[225, 65, 65], [80, 160, 70], [120, 90, 50]],
  Orange: [[255, 140, 30], [80, 160, 70]],
  Banana: [[255, 220, 50], [200, 170, 40], [120, 90, 50]],
  Watermelon: [[80, 160, 70], [50, 110, 50], [230, 70, 80], [40, 30, 30]],
  Kiwi: [[140, 200, 100], [120, 90, 50], [60, 50, 40]],

  // ---- Dragons (thematic colors) ----
  "Fire Dragon": [[220, 60, 30], [255, 140, 30], [255, 200, 50]],
  "Ice Dragon": [[150, 200, 255], [200, 230, 255], [100, 150, 200]],
  "Forest Dragon": [[60, 140, 60], [40, 100, 40], [120, 180, 80]],
  "Water Dragon": [[60, 130, 200], [40, 90, 160], [150, 200, 230]],
  "Earth Dragon": [[140, 100, 60], [100, 70, 40], [180, 150, 110]],
  "Wind Dragon": [[200, 220, 230], [160, 190, 210], [230, 240, 245]],
  "Crystal Dragon": [[180, 220, 240], [140, 200, 230], [220, 240, 250]],
  "Shadow Dragon": [[60, 50, 70], [40, 30, 50], [100, 90, 110]],
  "Light Dragon": [[255, 240, 180], [255, 220, 120], [255, 255, 220]],
  "Thunder Dragon": [[255, 220, 50], [120, 100, 200], [255, 250, 200]],
  "Moon Dragon": [[200, 210, 230], [150, 170, 200], [230, 235, 245]],
  "Sun Dragon": [[255, 200, 50], [255, 150, 30], [255, 240, 180]],
  "Star Dragon": [[255, 240, 150], [200, 180, 100], [255, 255, 220]],
  "Cloud Dragon": [[220, 230, 240], [180, 200, 220], [240, 245, 250]],
  "Mountain Dragon": [[130, 120, 110], [100, 90, 80], [170, 160, 150]],
  "Ocean Dragon": [[60, 130, 180], [40, 100, 150], [120, 180, 210]],
  "Volcano Dragon": [[200, 60, 30], [80, 60, 60], [255, 140, 30]],
  "Storm Dragon": [[80, 80, 110], [60, 60, 90], [150, 150, 180]],
  "Gold Dragon": [[255, 200, 50], [200, 150, 30], [255, 230, 130]],
  "Silver Dragon": [[200, 210, 220], [160, 170, 180], [230, 235, 240]],
  "Bronze Dragon": [[180, 130, 60], [140, 100, 40], [210, 170, 100]],
  "Copper Dragon": [[200, 120, 70], [160, 90, 50], [230, 160, 110]],
  "Jade Dragon": [[120, 200, 140], [80, 160, 100], [170, 230, 190]],
  "Ruby Dragon": [[220, 40, 60], [160, 20, 40], [255, 120, 140]],
  "Sapphire Dragon": [[50, 100, 220], [30, 70, 180], [120, 160, 240]],
  "Emerald Dragon": [[60, 180, 100], [40, 140, 70], [120, 220, 150]],
  "Amethyst Dragon": [[160, 100, 200], [120, 70, 170], [200, 150, 230]],
  "Phoenix Dragon": [[255, 100, 30], [220, 50, 30], [255, 200, 80]],
  "Desert Dragon": [[220, 190, 120], [180, 150, 90], [240, 220, 170]],
  "Nature Dragon": [[80, 160, 70], [60, 130, 50], [140, 200, 120]],

  // ---- Ocean Animals ----
  Whale: [[80, 120, 160], [60, 100, 140], [150, 180, 200]],
  Shark: [[100, 110, 120], [70, 80, 90], [180, 190, 200]],
  Dolphin: [[120, 150, 180], [90, 120, 150], [200, 215, 225]],
  Octopus: [[180, 80, 130], [140, 50, 100], [220, 140, 180]],
  Turtle: [[80, 150, 80], [50, 110, 50], [200, 200, 150]],
  Crab: [[220, 60, 50], [180, 40, 30], [255, 150, 140]],
  Starfish: [[255, 140, 80], [220, 100, 50], [255, 190, 140]],
  Seahorse: [[255, 160, 80], [220, 120, 50], [255, 200, 140]],
  Jellyfish: [[200, 150, 220], [170, 120, 200], [230, 200, 240]],
  Lobster: [[200, 60, 40], [160, 40, 30], [230, 130, 110]],
  Shrimp: [[240, 150, 130], [200, 110, 100], [255, 190, 180]],
  Squid: [[220, 180, 200], [180, 140, 170], [240, 210, 225]],
  Eel: [[80, 100, 120], [50, 70, 90], [130, 150, 170]],
  Stingray: [[120, 130, 140], [90, 100, 110], [180, 190, 200]],
  Pufferfish: [[255, 200, 80], [220, 160, 50], [255, 230, 150]],
  Clownfish: [[255, 130, 30], [255, 255, 255], [40, 30, 30]],
  Angelfish: [[255, 220, 80], [80, 150, 200], [40, 30, 30]],
  Swordfish: [[90, 110, 130], [60, 80, 100], [160, 180, 195]],
  Seal: [[120, 120, 130], [90, 90, 100], [180, 180, 190]],
  Walrus: [[150, 120, 100], [120, 90, 70], [200, 175, 155]],
  Penguin: [[40, 40, 50], [255, 255, 255], [240, 180, 60]],
  "Sea Otter": [[120, 90, 60], [90, 65, 40], [170, 140, 110]],
  Manatee: [[140, 150, 150], [110, 120, 120], [180, 185, 185]],
  "Hermit Crab": [[200, 140, 80], [220, 80, 60], [160, 110, 60]],
  "Sea Urchin": [[80, 60, 90], [60, 40, 70], [120, 100, 130]],
  Coral: [[255, 130, 130], [255, 170, 130], [230, 100, 150]],
  "Sea Anemone": [[220, 120, 180], [180, 90, 150], [240, 170, 210]],
  "Manta Ray": [[60, 70, 90], [40, 50, 70], [120, 130, 145]],
  Orca: [[30, 30, 40], [255, 255, 255], [60, 60, 70]],
  "Moray Eel": [[60, 100, 80], [40, 70, 55], [100, 140, 115]],

  // ---- Wild Animals ----
  Lion: [[200, 160, 80], [160, 120, 50], [240, 220, 180]],
  Tiger: [[255, 160, 50], [40, 30, 30], [255, 220, 180]],
  Elephant: [[130, 120, 110], [100, 90, 80], [170, 160, 150]],
  Giraffe: [[255, 200, 100], [160, 110, 60], [255, 230, 180]],
  Zebra: [[255, 255, 255], [30, 30, 30], [200, 200, 200]],
  Bear: [[140, 90, 60], [100, 65, 40], [180, 130, 100]],
  Monkey: [[150, 110, 70], [110, 80, 50], [200, 170, 140]],
  Kangaroo: [[180, 140, 100], [140, 100, 70], [220, 190, 160]],
  Hippo: [[150, 140, 150], [120, 110, 120], [190, 180, 190]],
  Rhino: [[140, 140, 140], [110, 110, 110], [180, 180, 180]],
  Cheetah: [[255, 200, 100], [80, 60, 40], [255, 230, 180]],
  Leopard: [[255, 220, 100], [60, 50, 40], [255, 240, 200]],
  Panther: [[40, 40, 50], [25, 25, 35], [70, 70, 80]],
  Wolf: [[130, 120, 115], [90, 80, 75], [180, 170, 165]],
  Fox: [[230, 120, 50], [180, 80, 30], [255, 200, 170]],
  Deer: [[170, 130, 80], [130, 95, 55], [220, 195, 160]],
  Moose: [[120, 90, 60], [90, 65, 40], [170, 140, 110]],
  Bison: [[140, 100, 70], [100, 70, 45], [180, 145, 115]],
  Camel: [[200, 170, 120], [160, 130, 85], [230, 205, 165]],
  Llama: [[230, 230, 230], [200, 200, 200], [245, 245, 245]],
  Panda: [[255, 255, 255], [30, 30, 30], [220, 220, 220]],
  Koala: [[150, 150, 140], [110, 110, 100], [190, 190, 180]],
  Sloth: [[170, 140, 90], [130, 100, 60], [210, 185, 145]],
  Anteater: [[150, 110, 80], [110, 75, 50], [200, 170, 140]],
  Armadillo: [[200, 180, 150], [160, 140, 110], [230, 215, 190]],
  Porcupine: [[150, 120, 90], [110, 85, 60], [190, 165, 135]],
  Beaver: [[140, 100, 70], [100, 70, 45], [180, 145, 115]],
  Raccoon: [[180, 180, 180], [40, 40, 40], [220, 220, 220]],
  Skunk: [[30, 30, 30], [255, 255, 255], [60, 60, 60]],
  Gorilla: [[80, 70, 65], [50, 45, 40], [130, 115, 105]],

  // ---- Dinosaurs (thematic — greens/browns/greys) ----
  "T-Rex": [[120, 150, 80], [80, 110, 50], [180, 200, 140]],
  Triceratops: [[150, 130, 90], [110, 90, 60], [200, 180, 140]],
  Stegosaurus: [[90, 140, 90], [60, 100, 60], [150, 190, 140]],
  Brachiosaurus: [[140, 160, 120], [100, 120, 85], [190, 205, 170]],
  Velociraptor: [[160, 130, 80], [120, 90, 50], [210, 185, 140]],
  Pterodactyl: [[150, 120, 100], [110, 85, 65], [200, 175, 155]],
  Ankylosaurus: [[120, 110, 90], [85, 75, 60], [170, 160, 140]],
  Diplodocus: [[130, 150, 110], [95, 115, 80], [180, 195, 165]],
  Spinosaurus: [[100, 130, 120], [70, 100, 90], [150, 175, 165]],
  Parasaurolophus: [[180, 130, 90], [140, 90, 55], [220, 180, 145]],
  Iguanodon: [[130, 140, 90], [95, 105, 65], [175, 185, 140]],
  Allosaurus: [[140, 110, 80], [100, 75, 50], [190, 165, 140]],
  Brontosaurus: [[140, 155, 125], [100, 115, 90], [185, 200, 175]],
  Ceratosaurus: [[130, 100, 85], [95, 70, 55], [175, 145, 130]],
  Compsognathus: [[170, 140, 95], [130, 100, 65], [210, 185, 150]],
  Deinonychus: [[150, 120, 85], [110, 85, 55], [195, 170, 140]],
  Gallimimus: [[180, 160, 120], [140, 120, 85], [215, 200, 165]],
  Hadrosaurus: [[130, 150, 100], [95, 115, 70], [175, 190, 150]],
  Kentrosaurus: [[120, 140, 90], [85, 105, 60], [165, 185, 135]],
  Lambeosaurus: [[160, 130, 100], [120, 90, 65], [205, 180, 155]],
  Maiasaura: [[140, 150, 110], [100, 110, 80], [185, 195, 165]],
  Oviraptor: [[180, 150, 110], [140, 110, 75], [215, 190, 160]],
  Pachycephalosaurus: [[150, 120, 95], [110, 85, 65], [190, 165, 145]],
  Protoceratops: [[160, 140, 100], [120, 100, 70], [200, 180, 150]],
  Styracosaurus: [[130, 110, 85], [95, 80, 60], [175, 155, 135]],
  Therizinosaurus: [[120, 140, 100], [85, 105, 70], [165, 185, 145]],
  Utahraptor: [[150, 110, 80], [110, 80, 50], [195, 160, 135]],
  Archaeopteryx: [[160, 130, 90], [120, 90, 55], [205, 180, 145]],
  Saichania: [[130, 110, 95], [95, 80, 65], [175, 155, 140]],
  Dilophosaurus: [[180, 100, 80], [140, 70, 55], [220, 150, 135]],

  // ---- Flowers ----
  Rose: [[220, 50, 70], [80, 140, 60], [120, 90, 50]],
  Sunflower: [[255, 200, 50], [255, 160, 30], [80, 140, 60]],
  Tulip: [[230, 80, 110], [80, 140, 60], [120, 90, 50]],
  Daisy: [[255, 255, 255], [255, 200, 50], [80, 140, 60]],
  Lily: [[255, 250, 240], [255, 180, 100], [80, 140, 60]],
  Orchid: [[200, 100, 180], [160, 70, 150], [230, 170, 215]],
  Lotus: [[255, 180, 200], [255, 140, 170], [80, 140, 60]],
  Lavender: [[180, 140, 210], [150, 110, 190], [120, 90, 50]],
  Poppy: [[230, 60, 50], [40, 30, 30], [80, 140, 60]],
  Marigold: [[255, 140, 30], [255, 100, 20], [80, 140, 60]],
  Daffodil: [[255, 220, 80], [255, 180, 40], [80, 140, 60]],
  Hibiscus: [[230, 60, 90], [255, 120, 140], [80, 140, 60]],
  Jasmine: [[255, 250, 230], [200, 200, 180], [80, 140, 60]],
  Peony: [[255, 150, 180], [255, 110, 150], [80, 140, 60]],
  Chrysanthemum: [[255, 180, 60], [255, 140, 40], [80, 140, 60]],
  Carnation: [[255, 130, 160], [255, 100, 130], [80, 140, 60]],
  Iris: [[120, 100, 200], [80, 70, 160], [80, 140, 60]],
  Violet: [[150, 100, 200], [110, 70, 160], [80, 140, 60]],
  Dandelion: [[255, 220, 80], [255, 255, 230], [80, 140, 60]],
  Bluebell: [[120, 160, 220], [90, 130, 190], [80, 140, 60]],
  Snowdrop: [[255, 255, 255], [200, 210, 220], [80, 140, 60]],
  Crocus: [[180, 120, 200], [140, 90, 170], [80, 140, 60]],
  Azalea: [[240, 130, 150], [240, 100, 130], [80, 140, 60]],
  Camellia: [[230, 70, 90], [200, 50, 70], [80, 140, 60]],
  Magnolia: [[255, 220, 230], [255, 190, 210], [80, 140, 60]],
  Plumeria: [[255, 250, 230], [255, 220, 150], [80, 140, 60]],
  Zinnia: [[255, 100, 80], [255, 150, 100], [80, 140, 60]],
  Cosmos: [[230, 130, 180], [200, 100, 160], [80, 140, 60]],
  Snapdragon: [[255, 150, 200], [255, 120, 180], [80, 140, 60]],
  "Forget Me Not": [[100, 150, 220], [255, 220, 100], [80, 140, 60]],

  // ---- Insects ----
  Butterfly: [[255, 140, 60], [100, 150, 220], [255, 220, 100]],
  Bee: [[255, 200, 30], [40, 30, 30], [255, 250, 200]],
  Ladybug: [[220, 40, 40], [40, 30, 30], [255, 200, 200]],
  Ant: [[140, 80, 50], [100, 55, 30], [180, 120, 90]],
  Dragonfly: [[100, 180, 220], [80, 150, 200], [200, 230, 240]],
  Grasshopper: [[120, 180, 70], [90, 150, 50], [180, 210, 130]],
  Beetle: [[120, 80, 160], [90, 60, 130], [180, 150, 210]],
  Caterpillar: [[150, 200, 80], [255, 180, 60], [120, 160, 60]],
  Moth: [[180, 170, 150], [140, 130, 110], [220, 215, 200]],
  Spider: [[80, 60, 50], [50, 40, 30], [120, 95, 80]],
  Centipede: [[180, 140, 70], [140, 100, 50], [220, 190, 120]],
  Cicada: [[140, 120, 80], [100, 85, 55], [190, 170, 130]],
  Cricket: [[120, 150, 70], [90, 120, 50], [170, 195, 130]],
  Firefly: [[180, 200, 80], [120, 140, 50], [255, 255, 180]],
  Wasp: [[255, 200, 30], [40, 30, 30], [255, 240, 180]],
  Hornet: [[255, 180, 30], [40, 30, 30], [255, 230, 160]],
  "Praying Mantis": [[120, 180, 80], [90, 150, 60], [170, 210, 130]],
  "Stick Insect": [[130, 120, 70], [100, 90, 55], [170, 160, 110]],
  "Leaf Insect": [[100, 170, 70], [70, 140, 50], [150, 200, 110]],
  Snail: [[180, 150, 100], [140, 110, 70], [220, 195, 160]],
  Worm: [[200, 150, 110], [160, 110, 75], [230, 190, 160]],
  Mosquito: [[140, 130, 120], [100, 90, 80], [180, 170, 160]],
  Fly: [[120, 120, 120], [80, 80, 80], [180, 180, 180]],
  Termite: [[200, 180, 140], [160, 140, 100], [230, 215, 185]],
  Mayfly: [[220, 220, 200], [180, 180, 160], [240, 240, 230]],
  Damselfly: [[100, 180, 200], [70, 150, 180], [200, 230, 240]],
  "Stink Bug": [[120, 150, 80], [90, 120, 60], [170, 195, 130]],
  "Walking Stick": [[130, 110, 60], [100, 85, 45], [170, 150, 100]],
  "Honey Bee": [[255, 190, 30], [40, 30, 30], [255, 240, 180]],
  Bumblebee: [[255, 220, 50], [40, 30, 30], [255, 250, 200]],

  // ---- Food & Sweets ----
  "Ice Cream": [[255, 180, 200], [255, 200, 100], [180, 130, 80]],
  Cake: [[255, 200, 220], [255, 150, 180], [255, 240, 200]],
  Donut: [[255, 170, 200], [255, 120, 160], [120, 80, 50]],
  Cupcake: [[255, 180, 210], [255, 220, 130], [180, 130, 80]],
  Pizza: [[255, 200, 100], [220, 70, 50], [255, 240, 180]],
  Burger: [[200, 140, 80], [180, 90, 60], [255, 220, 100]],
  "Hot Dog": [[220, 80, 60], [255, 220, 160], [80, 140, 60]],
  Sandwich: [[220, 180, 120], [180, 220, 100], [200, 100, 80]],
  Taco: [[255, 220, 120], [180, 90, 60], [80, 140, 60]],
  Sushi: [[255, 250, 240], [255, 120, 100], [40, 40, 50]],
  Cookie: [[200, 150, 90], [120, 80, 50], [230, 200, 150]],
  Brownie: [[110, 70, 45], [80, 50, 30], [150, 110, 80]],
  Pie: [[220, 170, 100], [180, 130, 70], [255, 200, 150]],
  Muffin: [[180, 130, 80], [120, 160, 80], [220, 190, 140]],
  Croissant: [[225, 180, 110], [190, 145, 80], [245, 215, 160]],
  Bagel: [[225, 185, 130], [190, 150, 95], [245, 220, 175]],
  Pancake: [[225, 180, 120], [190, 140, 80], [255, 200, 80]],
  Waffle: [[220, 170, 90], [180, 130, 60], [255, 220, 120]],
  Chocolate: [[90, 55, 35], [60, 35, 20], [140, 90, 60]],
  Lollipop: [[255, 100, 150], [255, 200, 80], [255, 255, 255]],
  Candy: [[255, 100, 120], [255, 200, 80], [120, 200, 220]],
  "Cotton Candy": [[255, 170, 220], [180, 200, 255], [255, 220, 240]],
  Popsicle: [[255, 100, 100], [255, 200, 80], [180, 130, 80]],
  "Apple Pie": [[220, 170, 100], [200, 60, 60], [180, 130, 70]],
  Cheesecake: [[255, 240, 200], [255, 200, 150], [200, 150, 100]],
  Pretzel: [[180, 130, 70], [140, 95, 50], [220, 180, 130]],
  Popcorn: [[255, 245, 210], [255, 220, 160], [180, 130, 80]],
  Nachos: [[255, 220, 80], [200, 80, 50], [80, 140, 60]],
  Smoothie: [[220, 100, 140], [255, 180, 80], [120, 200, 120]],
  Milkshake: [[255, 200, 220], [180, 130, 80], [255, 240, 200]],

  // ---- Fantasy Creatures ----
  Unicorn: [[255, 255, 255], [255, 180, 220], [255, 220, 240]],
  Mermaid: [[80, 180, 200], [255, 180, 130], [60, 130, 180]],
  Fairy: [[255, 180, 220], [200, 150, 255], [255, 230, 180]],
  Wizard: [[120, 80, 180], [80, 50, 140], [200, 170, 100]],
  Gnome: [[200, 60, 60], [80, 60, 50], [200, 200, 180]],
  Troll: [[120, 140, 100], [80, 100, 65], [160, 180, 130]],
  Elf: [[120, 180, 120], [80, 140, 80], [220, 190, 150]],
  Dwarf: [[180, 80, 60], [120, 80, 50], [200, 170, 100]],
  Griffin: [[200, 160, 80], [120, 90, 60], [255, 230, 180]],
  Phoenix: [[255, 100, 30], [220, 50, 30], [255, 200, 80]],
  Centaur: [[170, 120, 70], [220, 190, 150], [120, 80, 50]],
  Minotaur: [[140, 90, 60], [100, 60, 35], [180, 130, 95]],
  Cyclops: [[150, 120, 90], [110, 85, 60], [200, 170, 140]],
  Goblin: [[120, 140, 80], [80, 100, 55], [160, 180, 110]],
  Ogre: [[130, 110, 80], [90, 75, 50], [170, 145, 115]],
  Pixie: [[180, 255, 200], [255, 200, 220], [255, 240, 180]],
  Sprite: [[180, 230, 255], [200, 255, 220], [255, 240, 200]],
  Nymph: [[180, 220, 180], [220, 200, 240], [255, 240, 220]],
  Dryad: [[120, 160, 80], [90, 120, 60], [180, 140, 90]],
  Banshee: [[220, 220, 240], [180, 180, 210], [240, 240, 250]],
  Kraken: [[80, 60, 90], [50, 35, 60], [120, 90, 130]],
  Leviathan: [[50, 80, 120], [30, 55, 90], [100, 130, 160]],
  Chimera: [[200, 100, 60], [120, 90, 60], [255, 200, 80]],
  Hydra: [[80, 130, 80], [50, 90, 55], [130, 170, 120]],
  Basilisk: [[120, 130, 60], [80, 90, 40], [170, 175, 100]],
  Cockatrice: [[200, 160, 80], [140, 100, 50], [255, 220, 150]],
  Manticore: [[200, 130, 60], [150, 80, 40], [255, 200, 120]],
  Sphinx: [[220, 180, 110], [170, 130, 70], [255, 220, 160]],
  Pegasus: [[255, 255, 255], [200, 220, 240], [220, 230, 245]],
  Siren: [[120, 180, 200], [255, 200, 160], [80, 140, 180]],

  // ---- Space ----
  Sun: [[255, 200, 50], [255, 140, 30], [255, 240, 180]],
  Mercury: [[160, 150, 140], [120, 110, 100], [200, 190, 180]],
  Venus: [[230, 190, 120], [200, 160, 90], [245, 215, 160]],
  Earth: [[80, 140, 200], [80, 160, 80], [255, 250, 240]],
  Mars: [[200, 90, 60], [150, 60, 40], [230, 140, 110]],
  Jupiter: [[220, 180, 130], [180, 130, 80], [240, 210, 170]],
  Saturn: [[230, 200, 140], [200, 170, 100], [245, 220, 170]],
  Uranus: [[150, 220, 230], [110, 190, 210], [200, 235, 240]],
  Neptune: [[80, 120, 200], [50, 90, 170], [130, 170, 220]],
  Moon: [[200, 200, 200], [160, 160, 160], [230, 230, 230]],
  Comet: [[200, 220, 255], [150, 180, 230], [255, 255, 255]],
  Asteroid: [[140, 130, 120], [100, 90, 80], [180, 170, 160]],
  Meteor: [[255, 150, 60], [200, 100, 40], [255, 220, 150]],
  Rocket: [[220, 220, 230], [200, 60, 60], [100, 130, 160]],
  Astronaut: [[255, 255, 255], [200, 200, 210], [255, 200, 50]],
  "Space Shuttle": [[220, 220, 230], [200, 60, 60], [100, 130, 160]],
  Satellite: [[200, 200, 210], [80, 130, 200], [150, 150, 160]],
  "Space Station": [[220, 220, 220], [180, 180, 180], [100, 130, 200]],
  Telescope: [[180, 180, 190], [120, 120, 130], [220, 220, 230]],
  Galaxy: [[200, 150, 220], [150, 100, 200], [255, 220, 180]],
  Nebula: [[200, 120, 180], [120, 100, 200], [255, 180, 150]],
  "Black Hole": [[40, 30, 60], [255, 150, 50], [80, 60, 100]],
  Supernova: [[255, 220, 150], [255, 140, 60], [255, 255, 220]],
  "Northern Lights": [[100, 220, 150], [120, 150, 220], [180, 100, 200]],
  "Solar Eclipse": [[40, 40, 50], [255, 200, 80], [80, 80, 90]],
  "Lunar Eclipse": [[180, 130, 100], [120, 80, 60], [220, 180, 150]],
  Constellation: [[50, 60, 100], [255, 240, 180], [100, 120, 180]],
  "Dwarf Planet": [[180, 150, 130], [140, 110, 90], [220, 195, 175]],
  Quasar: [[200, 100, 200], [255, 180, 100], [120, 80, 200]],
  Pulsar: [[150, 200, 255], [100, 150, 220], [220, 235, 255]],

  // ---- Vehicles (no natural color — handled by fallback) ----

  // ---- Pets & Domestic Animals ----
  Dog: [[180, 130, 80], [140, 100, 60], [230, 200, 160]],       // tan body + dark ear + light belly
  Cat: [[230, 140, 60], [200, 110, 40], [250, 230, 200]],        // orange tabby + dark stripes + light belly
  Hamster: [[220, 170, 100], [180, 130, 70], [250, 230, 200]],   // golden body + dark + light belly
  Rabbit: [[240, 240, 240], [210, 210, 210], [255, 200, 200]],   // white fur + grey shadow + pink inner ear
  Parrot: [[220, 60, 60], [80, 140, 220], [255, 200, 50]],       // red body + blue wing + yellow tail
  Goldfish: [[255, 140, 30], [255, 200, 50], [80, 130, 180]],    // orange body + yellow fin + blue water
  "Guinea Pig": [[150, 100, 70], [100, 70, 50], [220, 190, 160]], // brown + dark patches + cream
  Ferret: [[180, 150, 120], [120, 90, 70], [230, 220, 200]],     // sable body + dark mask + light belly
  Turtle: [[80, 150, 80], [50, 110, 50], [200, 200, 150]],       // green shell + dark shell + tan skin
  Chinchilla: [[180, 170, 170], [140, 130, 130], [220, 215, 215]], // grey fur + dark + light
  Gerbil: [[200, 160, 110], [160, 120, 80], [240, 220, 190]],    // agouti + dark + light belly
  Mouse: [[200, 190, 185], [160, 150, 145], [250, 200, 200]],    // grey + dark + pink ears
  Canary: [[255, 220, 50], [230, 180, 30], [255, 250, 200]],     // yellow body + dark wing + light belly
  Budgie: [[120, 200, 220], [80, 160, 200], [255, 255, 200]],    // turquoise body + dark wing + yellow face
  Cockatiel: [[200, 180, 120], [140, 120, 80], [255, 220, 100]], // grey body + dark + yellow crest
  "Bearded Dragon": [[210, 160, 80], [160, 110, 50], [240, 200, 130]], // tan + dark + light
  "Corn Snake": [[220, 160, 80], [200, 80, 60], [250, 220, 180]], // orange + red saddles + light belly
  "Leopard Gecko": [[255, 220, 120], [180, 130, 60], [240, 200, 130]], // yellow + dark spots + light
  "Betta Fish": [[200, 60, 120], [140, 40, 90], [120, 180, 220]], // magenta body + dark + blue fin
  "Koi Fish": [[255, 140, 30], [255, 255, 255], [40, 40, 40]],    // orange + white + black patches
  Hedgehog: [[150, 120, 90], [100, 80, 60], [230, 210, 190]],    // brown spines + dark + cream face
  "Sugar Glider": [[160, 130, 110], [120, 95, 80], [240, 230, 220]], // grey-brown + dark stripe + light belly
  "Pot-Bellied Pig": [[120, 90, 80], [90, 65, 55], [180, 150, 140]], // dark grey + darker + light
  "Mini Goat": [[240, 230, 220], [180, 160, 140], [60, 50, 40]],  // white + tan patches + dark hooves
  Chick: [[255, 220, 80], [255, 180, 40], [255, 180, 60]],        // yellow body + dark wing + orange beak
  Duckling: [[255, 220, 80], [255, 180, 40], [255, 160, 50]],     // yellow + dark + orange beak
  Tarantula: [[100, 70, 50], [70, 45, 30], [160, 120, 90]],      // brown + dark + light hairs
  Snail: [[180, 150, 100], [140, 110, 70], [220, 200, 160]],     // tan shell + dark + light body
  Iguana: [[100, 160, 70], [60, 120, 50], [180, 200, 100]],      // green body + dark + light
  Finch: [[180, 130, 80], [120, 80, 50], [240, 220, 180]],       // brown + dark + light belly
};

// ---------------------------------------------------------------------------
// 30-COLOR FALLBACK PALETTE for items without a natural color
// (vehicles, some fantasy, some space). Deterministic offset per item name.
// ---------------------------------------------------------------------------
export const FALLBACK_PALETTE: Palette = [
  [231, 76, 60],    // red
  [230, 126, 34],   // orange
  [241, 196, 15],   // yellow
  [46, 204, 113],   // green
  [26, 188, 156],   // turquoise
  [52, 152, 219],   // blue
  [155, 89, 182],   // purple
  [236, 240, 241],  // white
  [149, 165, 166],  // grey
  [52, 73, 94],     // dark grey
  [255, 118, 117],  // light red
  [255, 165, 89],   // light orange
  [255, 215, 100],  // light yellow
  [100, 220, 150],  // light green
  [100, 220, 220],  // light turquoise
  [100, 170, 255],  // light blue
  [200, 140, 230],  // light purple
  [255, 180, 180],  // pink
  [180, 220, 255],  // sky
  [200, 240, 200],  // mint
  [255, 200, 150],  // peach
  [200, 255, 220],  // seafoam
  [240, 200, 255],  // lavender
  [255, 240, 180],  // cream
  [180, 200, 180],  // sage
  [220, 180, 140],  // tan
  [255, 150, 200],  // rose
  [150, 200, 255],  // periwinkle
  [255, 180, 100],  // apricot
  [180, 255, 180],  // lime
];

// Deterministic string hash → offset into fallback palette
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getPalette(item: string, category: string): Palette {
  // 1. Natural palette wins if defined.
  if (NATURAL_PALETTES[item]) return NATURAL_PALETTES[item];

  // 2. Otherwise use the fallback palette with a deterministic offset
  //    so each item gets unique-but-consistent colors.
  const offset = hashString(item) % FALLBACK_PALETTE.length;
  const rotated: Palette = [];
  for (let i = 0; i < FALLBACK_PALETTE.length; i++) {
    rotated.push(FALLBACK_PALETTE[(i + offset) % FALLBACK_PALETTE.length]);
  }
  return rotated;
}

// ---------------------------------------------------------------------------
// PDF page layout constants (exact spec from requirements).
// ---------------------------------------------------------------------------
export const PAGE_WIDTH = 612;       // 8.5 inches @ 72dpi
export const PAGE_HEIGHT = 792;      // 11 inches @ 72dpi
export const MARGIN = 36;            // 0.5 inches
export const REF_SIZE = 86;          // colored reference 86×86
export const REF_X = MARGIN;         // 36
export const REF_Y = MARGIN;         // 36 (top-left)
export const BW_SIZE = 380;          // B&W coloring 380×380
export const BW_X = (PAGE_WIDTH - BW_SIZE) / 2;  // 116
export const BW_Y = 132;             // below reference
export const TITLE_Y = 527;          // below the B&W image
export const PAGE_NUM_X = 546;       // right-aligned
export const PAGE_NUM_Y = 740;       // bottom-right

// Blank page size (used by assemble-pdf when -1 appears in pageOrder)
export const BLANK_PAGE_WIDTH = 612;
export const BLANK_PAGE_HEIGHT = 792;

// ---------------------------------------------------------------------------
// CATEGORY VISUAL THEMES — consistent gradient + badge color per category,
// used across Tab 1 book cards, Tab 2 select buttons, and the info box.
// ---------------------------------------------------------------------------
export interface CategoryTheme {
  gradient: string;       // tailwind gradient classes for top bar / accents
  badgeBg: string;        // badge background
  badgeText: string;      // badge text color
  emoji: string;          // category emoji
}

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  Dinosaurs: {
    gradient: "from-emerald-400 to-teal-500",
    badgeBg: "bg-emerald-50 border-emerald-200",
    badgeText: "text-emerald-700",
    emoji: "🦕",
  },
  Dragons: {
    gradient: "from-violet-400 to-purple-500",
    badgeBg: "bg-violet-50 border-violet-200",
    badgeText: "text-violet-700",
    emoji: "🐉",
  },
  "Ocean Animals": {
    gradient: "from-sky-400 to-blue-500",
    badgeBg: "bg-sky-50 border-sky-200",
    badgeText: "text-sky-700",
    emoji: "🐳",
  },
  Vehicles: {
    gradient: "from-orange-400 to-amber-500",
    badgeBg: "bg-orange-50 border-orange-200",
    badgeText: "text-orange-700",
    emoji: "🚗",
  },
  Flowers: {
    gradient: "from-pink-400 to-rose-500",
    badgeBg: "bg-pink-50 border-pink-200",
    badgeText: "text-pink-700",
    emoji: "🌸",
  },
  Insects: {
    gradient: "from-lime-400 to-green-500",
    badgeBg: "bg-lime-50 border-lime-200",
    badgeText: "text-lime-700",
    emoji: "🦋",
  },
  "Wild Animals": {
    gradient: "from-amber-400 to-orange-500",
    badgeBg: "bg-amber-50 border-amber-200",
    badgeText: "text-amber-700",
    emoji: "🦁",
  },
  "Fantasy Creatures": {
    gradient: "from-fuchsia-400 to-pink-500",
    badgeBg: "bg-fuchsia-50 border-fuchsia-200",
    badgeText: "text-fuchsia-700",
    emoji: "🦄",
  },
  Space: {
    gradient: "from-indigo-400 to-violet-500",
    badgeBg: "bg-indigo-50 border-indigo-200",
    badgeText: "text-indigo-700",
    emoji: "🚀",
  },
  "Food & Sweets": {
    gradient: "from-rose-400 to-red-500",
    badgeBg: "bg-rose-50 border-rose-200",
    badgeText: "text-rose-700",
    emoji: "🍰",
  },
  Pets: {
    gradient: "from-amber-400 to-orange-500",
    badgeBg: "bg-amber-50 border-amber-200",
    badgeText: "text-amber-700",
    emoji: "🐶",
  },
};

const DEFAULT_THEME: CategoryTheme = {
  gradient: "from-stone-400 to-stone-500",
  badgeBg: "bg-stone-50 border-stone-200",
  badgeText: "text-stone-700",
  emoji: "📚",
};

export function getCategoryTheme(category: string): CategoryTheme {
  return CATEGORY_THEMES[category] ?? DEFAULT_THEME;
}

