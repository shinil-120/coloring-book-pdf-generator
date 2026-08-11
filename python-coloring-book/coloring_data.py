"""
Coloring book data — Python port of src/lib/coloring-data.ts.

Contains:
  - 18 books × ~30 items each (523 total items)
  - Natural color palettes for ~520 items (largest region → palette[0], etc.)
  - 30-color fallback palette (rotated deterministically per item name)
  - NO-WHITE sanitizer (replaces white/near-white colors with visible tints)
  - PDF layout constants (exact match to the web app: 612×792, KDP margins)
"""
from __future__ import annotations

# Type aliases (match the TypeScript types)
RGB = tuple[int, int, int]
Palette = list[RGB]


# ─────────────────────────────────────────────────────────────────────────────
# CATEGORY SUFFIX used in image-generation prompts.
# "Kiwi" in a fruits book → "kiwi fruit", not "kiwi bird".
# ─────────────────────────────────────────────────────────────────────────────
CATEGORY_SUFFIX: dict[str, str] = {
    "Dinosaurs": "dinosaur",
    "Dragons": "dragon",
    "Ocean Animals": "ocean animal",
    "Vehicles": "vehicle",
    "Flowers": "flower",
    "Insects": "insect",
    "Wild Animals": "wild animal",
    "Fantasy Creatures": "fantasy creature",
    "Space": "space object",
    "Food & Sweets": "food",
    "Pets": "pet",
    "Birds": "bird",
    "Mandala": "mandala",
    "Musical Instruments": "musical instrument",
    "Indian Mythology": "Hindu deity",
    "Food": "food dish",
    "World Landmarks": "famous landmark",
    "Unicorns & Fairies": "magical fairy creature",
}


def category_suffix(category: str) -> str:
    return CATEGORY_SUFFIX.get(category, category.lower())


# ─────────────────────────────────────────────────────────────────────────────
# Book definitions — list of {name, slug, category, description, items}
# ─────────────────────────────────────────────────────────────────────────────
BOOKS: list[dict] = [
    {
        "name": "Dinosaurs Coloring Book",
        "slug": "Dinosaurs",
        "category": "Dinosaurs",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "T-Rex", "Triceratops", "Stegosaurus", "Brachiosaurus", "Velociraptor",
            "Pterodactyl", "Ankylosaurus", "Diplodocus", "Spinosaurus", "Parasaurolophus",
            "Iguanodon", "Allosaurus", "Brontosaurus", "Ceratosaurus", "Compsognathus",
            "Deinonychus", "Gallimimus", "Hadrosaurus", "Kentrosaurus", "Lambeosaurus",
            "Maiasaura", "Oviraptor", "Pachycephalosaurus", "Protoceratops", "Styracosaurus",
            "Therizinosaurus", "Utahraptor", "Archaeopteryx", "Saichania", "Dilophosaurus"
        ],
    },
    {
        "name": "Dragons Coloring Book",
        "slug": "Dragons",
        "category": "Dragons",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Fire Dragon", "Ice Dragon", "Water Dragon", "Earth Dragon", "Wind Dragon",
            "Crystal Dragon", "Shadow Dragon", "Light Dragon", "Thunder Dragon", "Forest Dragon",
            "Moon Dragon", "Sun Dragon", "Star Dragon", "Cloud Dragon", "Mountain Dragon",
            "Ocean Dragon", "Volcano Dragon", "Storm Dragon", "Gold Dragon", "Silver Dragon",
            "Bronze Dragon", "Copper Dragon", "Jade Dragon", "Ruby Dragon", "Sapphire Dragon",
            "Emerald Dragon", "Amethyst Dragon", "Phoenix Dragon", "Desert Dragon", "Nature Dragon"
        ],
    },
    {
        "name": "Ocean Animals Coloring Book",
        "slug": "Ocean-Animals",
        "category": "Ocean Animals",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Whale", "Shark", "Dolphin", "Octopus", "Turtle",
            "Crab", "Starfish", "Seahorse", "Jellyfish", "Lobster",
            "Shrimp", "Squid", "Eel", "Stingray", "Pufferfish",
            "Clownfish", "Angelfish", "Swordfish", "Seal", "Walrus",
            "Penguin", "Sea Otter", "Manatee", "Hermit Crab", "Sea Urchin",
            "Coral", "Sea Anemone", "Manta Ray", "Orca", "Moray Eel"
        ],
    },
    {
        "name": "Vehicles Coloring Book",
        "slug": "Vehicles",
        "category": "Vehicles",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Car", "Truck", "Bus", "Motorcycle", "Airplane",
            "Helicopter", "Train", "Submarine", "Rocket", "Tractor",
            "Bicycle", "Scooter", "Ambulance", "Fire Truck", "Police Car",
            "Taxi", "Van", "Pickup Truck", "Dump Truck", "Excavator",
            "Bulldozer", "Crane", "Forklift", "Sailboat", "Speedboat",
            "Hot Air Balloon", "Glider", "Cable Car", "Monorail", "Tractor Trailer"
        ],
    },
    {
        "name": "Flowers Coloring Book",
        "slug": "Flowers",
        "category": "Flowers",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Rose", "Sunflower", "Tulip", "Daisy", "Lily",
            "Orchid", "Lotus", "Lavender", "Poppy", "Marigold",
            "Daffodil", "Hibiscus", "Jasmine", "Peony", "Chrysanthemum",
            "Carnation", "Iris", "Violet", "Dandelion", "Bluebell",
            "Snowdrop", "Crocus", "Azalea", "Camellia", "Magnolia",
            "Plumeria", "Zinnia", "Cosmos", "Snapdragon", "Forget Me Not"
        ],
    },
    {
        "name": "Insects Coloring Book",
        "slug": "Insects",
        "category": "Insects",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Butterfly", "Bee", "Ladybug", "Ant", "Dragonfly",
            "Grasshopper", "Beetle", "Caterpillar", "Moth", "Spider",
            "Centipede", "Cicada", "Cricket", "Firefly", "Wasp",
            "Hornet", "Praying Mantis", "Stick Insect", "Leaf Insect", "Snail",
            "Worm", "Mosquito", "Fly", "Termite", "Mayfly",
            "Damselfly", "Stink Bug", "Walking Stick", "Honey Bee", "Bumblebee"
        ],
    },
    {
        "name": "Wild Animals Coloring Book",
        "slug": "Wild-Animals",
        "category": "Wild Animals",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Lion", "Tiger", "Elephant", "Giraffe", "Zebra",
            "Bear", "Monkey", "Kangaroo", "Hippo", "Rhino",
            "Cheetah", "Leopard", "Panther", "Wolf", "Fox",
            "Deer", "Moose", "Bison", "Camel", "Llama",
            "Panda", "Koala", "Sloth", "Anteater", "Armadillo",
            "Porcupine", "Beaver", "Raccoon", "Skunk", "Gorilla"
        ],
    },
    {
        "name": "Fantasy Creatures Coloring Book",
        "slug": "Fantasy-Creatures",
        "category": "Fantasy Creatures",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Unicorn", "Mermaid", "Fairy", "Wizard", "Gnome",
            "Troll", "Elf", "Dwarf", "Griffin", "Phoenix",
            "Centaur", "Minotaur", "Cyclops", "Goblin", "Ogre",
            "Pixie", "Sprite", "Nymph", "Dryad", "Banshee",
            "Kraken", "Leviathan", "Chimera", "Hydra", "Basilisk",
            "Cockatrice", "Manticore", "Sphinx", "Pegasus", "Siren"
        ],
    },
    {
        "name": "Space Coloring Book",
        "slug": "Space",
        "category": "Space",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Sun", "Mercury", "Venus", "Earth", "Mars",
            "Jupiter", "Saturn", "Uranus", "Neptune", "Moon",
            "Comet", "Asteroid", "Meteor", "Rocket", "Astronaut",
            "Space Shuttle", "Satellite", "Space Station", "Telescope", "Galaxy",
            "Nebula", "Black Hole", "Supernova", "Northern Lights", "Solar Eclipse",
            "Lunar Eclipse", "Constellation", "Dwarf Planet", "Quasar", "Pulsar"
        ],
    },
    {
        "name": "Food & Sweets Coloring Book",
        "slug": "Food-Sweets",
        "category": "Food & Sweets",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Ice Cream", "Cake", "Donut", "Cupcake", "Pizza",
            "Burger", "Hot Dog", "Sandwich", "Taco", "Sushi",
            "Cookie", "Brownie", "Pie", "Muffin", "Croissant",
            "Bagel", "Pancake", "Waffle", "Chocolate", "Lollipop",
            "Candy", "Cotton Candy", "Popsicle", "Apple Pie", "Cheesecake",
            "Pretzel", "Popcorn", "Nachos", "Smoothie", "Milkshake"
        ],
    },
    {
        "name": "Pets Coloring Book",
        "slug": "Pets",
        "category": "Pets",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Dog", "Cat", "Hamster", "Rabbit", "Parrot",
            "Goldfish", "Guinea Pig", "Ferret", "Turtle", "Chinchilla",
            "Gerbil", "Mouse", "Canary", "Budgie", "Cockatiel",
            "Bearded Dragon", "Corn Snake", "Leopard Gecko", "Betta Fish", "Koi Fish",
            "Hedgehog", "Sugar Glider", "Pot-Bellied Pig", "Mini Goat", "Chick",
            "Duckling", "Tarantula", "Snail", "Iguana", "Finch"
        ],
    },
    {
        "name": "Birds Coloring Book",
        "slug": "Birds",
        "category": "Birds",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Eagle", "Owl", "Flamingo", "Peacock", "Penguin",
            "Hummingbird", "Parrot", "Robin", "Sparrow", "Cardinal",
            "Blue Jay", "Woodpecker", "Kingfisher", "Pelican", "Seagull",
            "Stork", "Crane", "Heron", "Swan", "Goose",
            "Duck", "Rooster", "Hen", "Chick", "Turkey",
            "Ostrich", "Toucan", "Vulture", "Falcon", "Hawk"
        ],
    },
    {
        "name": "Mandala Art Coloring Book",
        "slug": "Mandala",
        "category": "Mandala",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Flower Mandala", "Geometric Mandala", "Lotus Mandala", "Sun Mandala", "Star Mandala",
            "Celtic Mandala", "Zen Mandala", "Peacock Mandala", "Moon Mandala", "Leaf Mandala",
            "Spiral Mandala", "Butterfly Mandala", "Ocean Mandala", "Fire Mandala", "Crystal Mandala",
            "Tribal Mandala", "Cosmic Mandala", "Garden Mandala", "Snowflake Mandala", "Heart Mandala",
            "Phoenix Mandala", "Dragon Mandala", "Eagle Mandala", "Elephant Mandala", "Lion Mandala",
            "Tree of Life Mandala", "Wave Mandala", "Desert Mandala", "Rainbow Mandala", "Galaxy Mandala"
        ],
    },
    {
        "name": "Musical Instruments Coloring Book",
        "slug": "Musical-Instruments",
        "category": "Musical Instruments",
        "description": "30 pages \u2014 no covers, no blanks",
        "items": [
            "Guitar", "Piano", "Violin", "Drums", "Trumpet",
            "Saxophone", "Flute", "Cello", "Clarinet", "Banjo",
            "Harp", "Accordion", "Trombone", "Xylophone", "Tambourine",
            "Maracas", "Harmonica", "Oboe", "Bassoon", "Tuba",
            "French Horn", "Keyboard", "Ukulele", "Mandolin", "Sitar",
            "Bongos", "Conga", "Triangle", "Castanets", "Didgeridoo"
        ],
    },
    {
        "name": "Indian Mythology and Gods Coloring Book",
        "slug": "Indian-Mythology",
        "category": "Indian Mythology",
        "description": "50 pages \u2014 no covers, no blanks",
        "items": [
            "Ganesha", "Krishna", "Shiva", "Durga", "Hanuman",
            "Lakshmi", "Saraswati", "Vishnu", "Rama", "Kali",
            "Brahma", "Kartikeya", "Radha Krishna", "Sita", "Arjuna",
            "Ravana", "Garuda", "Dwarka Temple", "Kailash", "Chariot of Sun God",
            "Trishul", "Lotus Pond Temple", "Diya Lamp", "Om Symbol", "Peacock Throne",
            "Goddess Ganga", "Indra Deva", "Agni Deva", "Vayu Deva", "Varuna Deva",
            "Surya Deva", "Chandra Deva", "Yama Deva", "Kubera Deva", "Rudra",
            "Parvati", "Savitri", "Gayatri", "Nataraja Shiva", "Ardhanarishvara Shiva",
            "Bhairava Shiva", "Matsya Avatar Vishnu", "Kurma Avatar Vishnu", "Narasimha Avatar Vishnu", "Varaha Avatar Vishnu",
            "Vamana Avatar Vishnu", "Parashurama Avatar Vishnu", "Mahabali", "Karthikeya on Peacock", "Mohini Avatar Vishnu"
        ],
    },
    {
        "name": "Food Coloring Book",
        "slug": "Food",
        "category": "Food",
        "description": "10 pages \u2014 no covers, no blanks",
        "items": [
            "Omelette", "Waffles", "Fried Chicken", "Hot Dog", "Croissant",
            "Red Velvet Cupcake", "Baklava", "Grilled Bacon", "Fish and Chips", "Samosa"
        ],
    },
    {
        "name": "Around the World Landmarks Coloring Book",
        "slug": "World-Landmarks",
        "category": "World Landmarks",
        "description": "40 pages \u2014 no covers, no blanks",
        "items": [
            "Eiffel Tower", "Big Ben", "Taj Mahal", "Pyramids of Giza", "Statue of Liberty",
            "Colosseum", "Sydney Opera House", "Great Wall of China", "Leaning Tower of Pisa", "Christ the Redeemer",
            "Stonehenge", "Mount Rushmore", "Burj Khalifa", "Golden Gate Bridge", "Tower Bridge",
            "Machu Picchu", "Petra", "Parthenon", "St Basil Cathedral", "Neuschwanstein Castle",
            "CN Tower", "Hollywood Sign", "Easter Island Moai", "Angkor Wat", "Hagia Sophia",
            "Mont Saint Michel", "Sagrada Familia", "Chichen Itza", "Tokyo Tower", "Imperial Palace",
            "Acropolis", "Edinburgh Castle", "Buckingham Palace", "White House", "Niagara Falls",
            "Grand Canyon", "Northern Lights", "Imperial Palace Gate", "Trevi Fountain", "Pompeii Ruins"
        ],
    },
    {
        "name": "Magical Unicorns & Fairies Coloring Book",
        "slug": "Unicorns-Fairies",
        "category": "Unicorns & Fairies",
        "description": "3 pages \u2014 no covers, no blanks",
        "items": [
            "Unicorn Rainbow", "Fairy Garden", "Pegasus Cloud Castle"
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# NATURAL COLOR PALETTES — keyed by item name.
# Largest enclosed region → palette[0], second → palette[1], etc.
# ─────────────────────────────────────────────────────────────────────────────
NATURAL_PALETTES: dict[str, list[list[int]]] = {
  # ---- Fruits (inside Food & Sweets category, but palette applies by name) ----
  "Apple": [[225, 65, 65], [80, 160, 70], [120, 90, 50]],
  "Orange": [[255, 140, 30], [80, 160, 70]],
  "Banana": [[255, 220, 50], [200, 170, 40], [120, 90, 50]],
  "Watermelon": [[80, 160, 70], [50, 110, 50], [230, 70, 80], [40, 30, 30]],
  "Kiwi": [[140, 200, 100], [120, 90, 50], [60, 50, 40]],

  # ---- Dragons (thematic colors) ----
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

  # ---- Ocean Animals ----
  "Whale": [[80, 120, 160], [60, 100, 140], [150, 180, 200]],
  "Shark": [[100, 110, 120], [70, 80, 90], [180, 190, 200]],
  "Dolphin": [[120, 150, 180], [90, 120, 150], [200, 215, 225]],
  "Octopus": [[180, 80, 130], [140, 50, 100], [220, 140, 180]],
  "Turtle": [[80, 150, 80], [50, 110, 50], [200, 200, 150]],
  "Crab": [[220, 60, 50], [180, 40, 30], [255, 150, 140]],
  "Starfish": [[255, 140, 80], [220, 100, 50], [255, 190, 140]],
  "Seahorse": [[255, 160, 80], [220, 120, 50], [255, 200, 140]],
  "Jellyfish": [[200, 150, 220], [170, 120, 200], [230, 200, 240]],
  "Lobster": [[200, 60, 40], [160, 40, 30], [230, 130, 110]],
  "Shrimp": [[240, 150, 130], [200, 110, 100], [255, 190, 180]],
  "Squid": [[220, 180, 200], [180, 140, 170], [240, 210, 225]],
  "Eel": [[80, 100, 120], [50, 70, 90], [130, 150, 170]],
  "Stingray": [[120, 130, 140], [90, 100, 110], [180, 190, 200]],
  "Pufferfish": [[255, 200, 80], [220, 160, 50], [255, 230, 150]],
  "Clownfish": [[255, 130, 30], [220, 220, 225], [40, 30, 30]],
  "Angelfish": [[255, 220, 80], [80, 150, 200], [40, 30, 30]],
  "Swordfish": [[90, 110, 130], [60, 80, 100], [160, 180, 195]],
  "Seal": [[120, 120, 130], [90, 90, 100], [180, 180, 190]],
  "Walrus": [[150, 120, 100], [120, 90, 70], [200, 175, 155]],
  "Penguin": [[40, 40, 50], [215, 215, 220], [240, 180, 60]],
  "Sea Otter": [[120, 90, 60], [90, 65, 40], [170, 140, 110]],
  "Manatee": [[140, 150, 150], [110, 120, 120], [180, 185, 185]],
  "Hermit Crab": [[200, 140, 80], [220, 80, 60], [160, 110, 60]],
  "Sea Urchin": [[80, 60, 90], [60, 40, 70], [120, 100, 130]],
  "Coral": [[255, 130, 130], [255, 170, 130], [230, 100, 150]],
  "Sea Anemone": [[220, 120, 180], [180, 90, 150], [240, 170, 210]],
  "Manta Ray": [[60, 70, 90], [40, 50, 70], [120, 130, 145]],
  "Orca": [[30, 30, 40], [210, 212, 218], [60, 60, 70]],
  "Moray Eel": [[60, 100, 80], [40, 70, 55], [100, 140, 115]],

  # ---- Wild Animals ----
  "Lion": [[200, 160, 80], [160, 120, 50], [240, 220, 180]],
  "Tiger": [[255, 160, 50], [40, 30, 30], [255, 220, 180]],
  "Elephant": [[130, 120, 110], [100, 90, 80], [170, 160, 150]],
  "Giraffe": [[255, 200, 100], [160, 110, 60], [255, 230, 180]],
  "Zebra": [[218, 218, 220], [30, 30, 30], [170, 170, 175]],
  "Bear": [[140, 90, 60], [100, 65, 40], [180, 130, 100]],
  "Monkey": [[150, 110, 70], [110, 80, 50], [200, 170, 140]],
  "Kangaroo": [[180, 140, 100], [140, 100, 70], [220, 190, 160]],
  "Hippo": [[150, 140, 150], [120, 110, 120], [190, 180, 190]],
  "Rhino": [[140, 140, 140], [110, 110, 110], [180, 180, 180]],
  "Cheetah": [[255, 200, 100], [80, 60, 40], [255, 230, 180]],
  "Leopard": [[255, 220, 100], [60, 50, 40], [255, 240, 200]],
  "Panther": [[40, 40, 50], [25, 25, 35], [70, 70, 80]],
  "Wolf": [[130, 120, 115], [90, 80, 75], [180, 170, 165]],
  "Fox": [[230, 120, 50], [180, 80, 30], [255, 200, 170]],
  "Deer": [[170, 130, 80], [130, 95, 55], [220, 195, 160]],
  "Moose": [[120, 90, 60], [90, 65, 40], [170, 140, 110]],
  "Bison": [[140, 100, 70], [100, 70, 45], [180, 145, 115]],
  "Camel": [[200, 170, 120], [160, 130, 85], [230, 205, 165]],
  "Llama": [[225, 222, 218], [200, 198, 195], [150, 130, 110]],
  "Panda": [[215, 215, 218], [30, 30, 30], [190, 190, 195]],
  "Koala": [[150, 150, 140], [110, 110, 100], [190, 190, 180]],
  "Sloth": [[170, 140, 90], [130, 100, 60], [210, 185, 145]],
  "Anteater": [[150, 110, 80], [110, 75, 50], [200, 170, 140]],
  "Armadillo": [[200, 180, 150], [160, 140, 110], [230, 215, 190]],
  "Porcupine": [[150, 120, 90], [110, 85, 60], [190, 165, 135]],
  "Beaver": [[140, 100, 70], [100, 70, 45], [180, 145, 115]],
  "Raccoon": [[180, 180, 180], [40, 40, 40], [220, 220, 220]],
  "Skunk": [[30, 30, 30], [210, 210, 215], [60, 60, 60]],
  "Gorilla": [[80, 70, 65], [50, 45, 40], [130, 115, 105]],

  # ---- Dinosaurs (thematic — greens/browns/greys) ----
  "T-Rex": [[120, 150, 80], [80, 110, 50], [180, 200, 140]],
  "Triceratops": [[150, 130, 90], [110, 90, 60], [200, 180, 140]],
  "Stegosaurus": [[90, 140, 90], [60, 100, 60], [150, 190, 140]],
  "Brachiosaurus": [[140, 160, 120], [100, 120, 85], [190, 205, 170]],
  "Velociraptor": [[160, 130, 80], [120, 90, 50], [210, 185, 140]],
  "Pterodactyl": [[150, 120, 100], [110, 85, 65], [200, 175, 155]],
  "Ankylosaurus": [[120, 110, 90], [85, 75, 60], [170, 160, 140]],
  "Diplodocus": [[130, 150, 110], [95, 115, 80], [180, 195, 165]],
  "Spinosaurus": [[100, 130, 120], [70, 100, 90], [150, 175, 165]],
  "Parasaurolophus": [[180, 130, 90], [140, 90, 55], [220, 180, 145]],
  "Iguanodon": [[130, 140, 90], [95, 105, 65], [175, 185, 140]],
  "Allosaurus": [[140, 110, 80], [100, 75, 50], [190, 165, 140]],
  "Brontosaurus": [[140, 155, 125], [100, 115, 90], [185, 200, 175]],
  "Ceratosaurus": [[130, 100, 85], [95, 70, 55], [175, 145, 130]],
  "Compsognathus": [[170, 140, 95], [130, 100, 65], [210, 185, 150]],
  "Deinonychus": [[150, 120, 85], [110, 85, 55], [195, 170, 140]],
  "Gallimimus": [[180, 160, 120], [140, 120, 85], [215, 200, 165]],
  "Hadrosaurus": [[130, 150, 100], [95, 115, 70], [175, 190, 150]],
  "Kentrosaurus": [[120, 140, 90], [85, 105, 60], [165, 185, 135]],
  "Lambeosaurus": [[160, 130, 100], [120, 90, 65], [205, 180, 155]],
  "Maiasaura": [[140, 150, 110], [100, 110, 80], [185, 195, 165]],
  "Oviraptor": [[180, 150, 110], [140, 110, 75], [215, 190, 160]],
  "Pachycephalosaurus": [[150, 120, 95], [110, 85, 65], [190, 165, 145]],
  "Protoceratops": [[160, 140, 100], [120, 100, 70], [200, 180, 150]],
  "Styracosaurus": [[130, 110, 85], [95, 80, 60], [175, 155, 135]],
  "Therizinosaurus": [[120, 140, 100], [85, 105, 70], [165, 185, 145]],
  "Utahraptor": [[150, 110, 80], [110, 80, 50], [195, 160, 135]],
  "Archaeopteryx": [[160, 130, 90], [120, 90, 55], [205, 180, 145]],
  "Saichania": [[130, 110, 95], [95, 80, 65], [175, 155, 140]],
  "Dilophosaurus": [[180, 100, 80], [140, 70, 55], [220, 150, 135]],

  # ---- Flowers ----
  "Rose": [[220, 50, 70], [80, 140, 60], [120, 90, 50]],
  "Sunflower": [[255, 200, 50], [255, 160, 30], [80, 140, 60]],
  "Tulip": [[230, 80, 110], [80, 140, 60], [120, 90, 50]],
  "Daisy": [[225, 222, 230], [255, 200, 50], [80, 140, 60]],
  "Lily": [[255, 250, 240], [255, 180, 100], [80, 140, 60]],
  "Orchid": [[200, 100, 180], [160, 70, 150], [230, 170, 215]],
  "Lotus": [[255, 180, 200], [255, 140, 170], [80, 140, 60]],
  "Lavender": [[180, 140, 210], [150, 110, 190], [120, 90, 50]],
  "Poppy": [[230, 60, 50], [40, 30, 30], [80, 140, 60]],
  "Marigold": [[255, 140, 30], [255, 100, 20], [80, 140, 60]],
  "Daffodil": [[255, 220, 80], [255, 180, 40], [80, 140, 60]],
  "Hibiscus": [[230, 60, 90], [255, 120, 140], [80, 140, 60]],
  "Jasmine": [[255, 250, 230], [200, 200, 180], [80, 140, 60]],
  "Peony": [[255, 150, 180], [255, 110, 150], [80, 140, 60]],
  "Chrysanthemum": [[255, 180, 60], [255, 140, 40], [80, 140, 60]],
  "Carnation": [[255, 130, 160], [255, 100, 130], [80, 140, 60]],
  "Iris": [[120, 100, 200], [80, 70, 160], [80, 140, 60]],
  "Violet": [[150, 100, 200], [110, 70, 160], [80, 140, 60]],
  "Dandelion": [[255, 220, 80], [255, 255, 230], [80, 140, 60]],
  "Bluebell": [[120, 160, 220], [90, 130, 190], [80, 140, 60]],
  "Snowdrop": [[225, 225, 235], [200, 210, 220], [80, 140, 60]],
  "Crocus": [[180, 120, 200], [140, 90, 170], [80, 140, 60]],
  "Azalea": [[240, 130, 150], [240, 100, 130], [80, 140, 60]],
  "Camellia": [[230, 70, 90], [200, 50, 70], [80, 140, 60]],
  "Magnolia": [[255, 220, 230], [255, 190, 210], [80, 140, 60]],
  "Plumeria": [[255, 250, 230], [255, 220, 150], [80, 140, 60]],
  "Zinnia": [[255, 100, 80], [255, 150, 100], [80, 140, 60]],
  "Cosmos": [[230, 130, 180], [200, 100, 160], [80, 140, 60]],
  "Snapdragon": [[255, 150, 200], [255, 120, 180], [80, 140, 60]],
  "Forget Me Not": [[100, 150, 220], [255, 220, 100], [80, 140, 60]],

  # ---- Insects ----
  "Butterfly": [[255, 140, 60], [100, 150, 220], [255, 220, 100]],
  "Bee": [[255, 200, 30], [40, 30, 30], [255, 250, 200]],
  "Ladybug": [[220, 40, 40], [40, 30, 30], [255, 200, 200]],
  "Ant": [[140, 80, 50], [100, 55, 30], [180, 120, 90]],
  "Dragonfly": [[100, 180, 220], [80, 150, 200], [200, 230, 240]],
  "Grasshopper": [[120, 180, 70], [90, 150, 50], [180, 210, 130]],
  "Beetle": [[120, 80, 160], [90, 60, 130], [180, 150, 210]],
  "Caterpillar": [[150, 200, 80], [255, 180, 60], [120, 160, 60]],
  "Moth": [[180, 170, 150], [140, 130, 110], [220, 215, 200]],
  "Spider": [[80, 60, 50], [50, 40, 30], [120, 95, 80]],
  "Centipede": [[180, 140, 70], [140, 100, 50], [220, 190, 120]],
  "Cicada": [[140, 120, 80], [100, 85, 55], [190, 170, 130]],
  "Cricket": [[120, 150, 70], [90, 120, 50], [170, 195, 130]],
  "Firefly": [[180, 200, 80], [120, 140, 50], [255, 255, 180]],
  "Wasp": [[255, 200, 30], [40, 30, 30], [255, 240, 180]],
  "Hornet": [[255, 180, 30], [40, 30, 30], [255, 230, 160]],
  "Praying Mantis": [[120, 180, 80], [90, 150, 60], [170, 210, 130]],
  "Stick Insect": [[130, 120, 70], [100, 90, 55], [170, 160, 110]],
  "Leaf Insect": [[100, 170, 70], [70, 140, 50], [150, 200, 110]],
  "Snail": [[180, 150, 100], [140, 110, 70], [220, 195, 160]],
  "Worm": [[200, 150, 110], [160, 110, 75], [230, 190, 160]],
  "Mosquito": [[140, 130, 120], [100, 90, 80], [180, 170, 160]],
  "Fly": [[120, 120, 120], [80, 80, 80], [180, 180, 180]],
  "Termite": [[200, 180, 140], [160, 140, 100], [230, 215, 185]],
  "Mayfly": [[220, 220, 200], [180, 180, 160], [240, 240, 230]],
  "Damselfly": [[100, 180, 200], [70, 150, 180], [200, 230, 240]],
  "Stink Bug": [[120, 150, 80], [90, 120, 60], [170, 195, 130]],
  "Walking Stick": [[130, 110, 60], [100, 85, 45], [170, 150, 100]],
  "Honey Bee": [[255, 190, 30], [40, 30, 30], [255, 240, 180]],
  "Bumblebee": [[255, 220, 50], [40, 30, 30], [255, 250, 200]],

  # ---- Food & Sweets ----
  "Ice Cream": [[255, 180, 200], [255, 200, 100], [180, 130, 80]],
  "Cake": [[255, 200, 220], [255, 150, 180], [255, 240, 200]],
  "Donut": [[255, 170, 200], [255, 120, 160], [120, 80, 50]],
  "Cupcake": [[255, 180, 210], [255, 220, 130], [180, 130, 80]],
  "Pizza": [[255, 200, 100], [220, 70, 50], [255, 240, 180]],
  "Burger": [[200, 140, 80], [180, 90, 60], [255, 220, 100]],
  "Hot Dog": [[220, 80, 60], [255, 220, 160], [80, 140, 60]],
  "Sandwich": [[220, 180, 120], [180, 220, 100], [200, 100, 80]],
  "Taco": [[255, 220, 120], [180, 90, 60], [80, 140, 60]],
  "Sushi": [[255, 250, 240], [255, 120, 100], [40, 40, 50]],
  "Cookie": [[200, 150, 90], [120, 80, 50], [230, 200, 150]],
  "Brownie": [[110, 70, 45], [80, 50, 30], [150, 110, 80]],
  "Pie": [[220, 170, 100], [180, 130, 70], [255, 200, 150]],
  "Muffin": [[180, 130, 80], [120, 160, 80], [220, 190, 140]],
  "Croissant": [[225, 180, 110], [190, 145, 80], [245, 215, 160]],
  "Bagel": [[225, 185, 130], [190, 150, 95], [245, 220, 175]],
  "Pancake": [[225, 180, 120], [190, 140, 80], [255, 200, 80]],
  "Waffle": [[220, 170, 90], [180, 130, 60], [255, 220, 120]],
  "Chocolate": [[90, 55, 35], [60, 35, 20], [140, 90, 60]],
  "Lollipop": [[255, 100, 150], [255, 200, 80], [255, 255, 255]],
  "Candy": [[255, 100, 120], [255, 200, 80], [120, 200, 220]],
  "Cotton Candy": [[255, 170, 220], [180, 200, 255], [255, 220, 240]],
  "Popsicle": [[255, 100, 100], [255, 200, 80], [180, 130, 80]],
  "Apple Pie": [[220, 170, 100], [200, 60, 60], [180, 130, 70]],
  "Cheesecake": [[255, 240, 200], [255, 200, 150], [200, 150, 100]],
  "Pretzel": [[180, 130, 70], [140, 95, 50], [220, 180, 130]],
  "Popcorn": [[255, 245, 210], [255, 220, 160], [180, 130, 80]],
  "Nachos": [[255, 220, 80], [200, 80, 50], [80, 140, 60]],
  "Smoothie": [[220, 100, 140], [255, 180, 80], [120, 200, 120]],
  "Milkshake": [[255, 200, 220], [180, 130, 80], [255, 240, 200]],

  # ---- Fantasy Creatures ----
  "Unicorn": [[225, 225, 232], [255, 180, 220], [240, 210, 235]],
  "Mermaid": [[80, 180, 200], [255, 180, 130], [60, 130, 180]],
  "Fairy": [[255, 180, 220], [200, 150, 255], [255, 230, 180]],
  "Wizard": [[120, 80, 180], [80, 50, 140], [200, 170, 100]],
  "Gnome": [[200, 60, 60], [80, 60, 50], [200, 200, 180]],
  "Troll": [[120, 140, 100], [80, 100, 65], [160, 180, 130]],
  "Elf": [[120, 180, 120], [80, 140, 80], [220, 190, 150]],
  "Dwarf": [[180, 80, 60], [120, 80, 50], [200, 170, 100]],
  "Griffin": [[200, 160, 80], [120, 90, 60], [255, 230, 180]],
  "Phoenix": [[255, 100, 30], [220, 50, 30], [255, 200, 80]],
  "Centaur": [[170, 120, 70], [220, 190, 150], [120, 80, 50]],
  "Minotaur": [[140, 90, 60], [100, 60, 35], [180, 130, 95]],
  "Cyclops": [[150, 120, 90], [110, 85, 60], [200, 170, 140]],
  "Goblin": [[120, 140, 80], [80, 100, 55], [160, 180, 110]],
  "Ogre": [[130, 110, 80], [90, 75, 50], [170, 145, 115]],
  "Pixie": [[180, 255, 200], [255, 200, 220], [255, 240, 180]],
  "Sprite": [[180, 230, 255], [200, 255, 220], [255, 240, 200]],
  "Nymph": [[180, 220, 180], [220, 200, 240], [255, 240, 220]],
  "Dryad": [[120, 160, 80], [90, 120, 60], [180, 140, 90]],
  "Banshee": [[220, 220, 240], [180, 180, 210], [240, 240, 250]],
  "Kraken": [[80, 60, 90], [50, 35, 60], [120, 90, 130]],
  "Leviathan": [[50, 80, 120], [30, 55, 90], [100, 130, 160]],
  "Chimera": [[200, 100, 60], [120, 90, 60], [255, 200, 80]],
  "Hydra": [[80, 130, 80], [50, 90, 55], [130, 170, 120]],
  "Basilisk": [[120, 130, 60], [80, 90, 40], [170, 175, 100]],
  "Cockatrice": [[200, 160, 80], [140, 100, 50], [255, 220, 150]],
  "Manticore": [[200, 130, 60], [150, 80, 40], [255, 200, 120]],
  "Sphinx": [[220, 180, 110], [170, 130, 70], [255, 220, 160]],
  "Pegasus": [[220, 222, 230], [200, 220, 240], [215, 225, 240]],
  "Siren": [[120, 180, 200], [255, 200, 160], [80, 140, 180]],

  # ---- Space ----
  "Sun": [[255, 200, 50], [255, 140, 30], [255, 240, 180]],
  "Mercury": [[160, 150, 140], [120, 110, 100], [200, 190, 180]],
  "Venus": [[230, 190, 120], [200, 160, 90], [245, 215, 160]],
  "Earth": [[80, 140, 200], [80, 160, 80], [255, 250, 240]],
  "Mars": [[200, 90, 60], [150, 60, 40], [230, 140, 110]],
  "Jupiter": [[220, 180, 130], [180, 130, 80], [240, 210, 170]],
  "Saturn": [[230, 200, 140], [200, 170, 100], [245, 220, 170]],
  "Uranus": [[150, 220, 230], [110, 190, 210], [200, 235, 240]],
  "Neptune": [[80, 120, 200], [50, 90, 170], [130, 170, 220]],
  "Moon": [[200, 200, 200], [160, 160, 160], [230, 230, 230]],
  "Comet": [[200, 220, 255], [150, 180, 230], [255, 255, 255]],
  "Asteroid": [[140, 130, 120], [100, 90, 80], [180, 170, 160]],
  "Meteor": [[255, 150, 60], [200, 100, 40], [255, 220, 150]],
  "Rocket": [[220, 220, 230], [200, 60, 60], [100, 130, 160]],
  "Astronaut": [[210, 212, 220], [180, 182, 190], [255, 200, 50]],
  "Space Shuttle": [[220, 220, 230], [200, 60, 60], [100, 130, 160]],
  "Satellite": [[200, 200, 210], [80, 130, 200], [150, 150, 160]],
  "Space Station": [[220, 220, 220], [180, 180, 180], [100, 130, 200]],
  "Telescope": [[180, 180, 190], [120, 120, 130], [220, 220, 230]],
  "Galaxy": [[200, 150, 220], [150, 100, 200], [255, 220, 180]],
  "Nebula": [[200, 120, 180], [120, 100, 200], [255, 180, 150]],
  "Black Hole": [[40, 30, 60], [255, 150, 50], [80, 60, 100]],
  "Supernova": [[255, 220, 150], [255, 140, 60], [255, 255, 220]],
  "Northern Lights": [[100, 220, 150], [120, 150, 220], [180, 100, 200]],
  "Solar Eclipse": [[40, 40, 50], [255, 200, 80], [80, 80, 90]],
  "Lunar Eclipse": [[180, 130, 100], [120, 80, 60], [220, 180, 150]],
  "Constellation": [[50, 60, 100], [255, 240, 180], [100, 120, 180]],
  "Dwarf Planet": [[180, 150, 130], [140, 110, 90], [220, 195, 175]],
  "Quasar": [[200, 100, 200], [255, 180, 100], [120, 80, 200]],
  "Pulsar": [[150, 200, 255], [100, 150, 220], [220, 235, 255]],

  # ---- Vehicles (no natural color — handled by fallback) ----

  # ---- Pets & Domestic Animals ----
  "Dog": [[180, 130, 80], [140, 100, 60], [210, 175, 130]],
  "Cat": [[230, 140, 60], [200, 110, 40], [220, 180, 130]],
  "Hamster": [[220, 170, 100], [180, 130, 70], [225, 195, 150]],
  "Rabbit": [[215, 215, 220], [180, 180, 185], [255, 195, 205]],
  "Parrot": [[220, 60, 60], [80, 140, 220], [255, 200, 50]],
  "Goldfish": [[255, 140, 30], [255, 200, 50], [80, 130, 180]],
  "Guinea Pig": [[150, 100, 70], [100, 70, 50], [220, 190, 160]],
  "Ferret": [[180, 150, 120], [120, 90, 70], [230, 220, 200]],
  "Turtle": [[80, 150, 80], [50, 110, 50], [200, 200, 150]],
  "Chinchilla": [[180, 170, 170], [140, 130, 130], [220, 215, 215]],
  "Gerbil": [[200, 160, 110], [160, 120, 80], [240, 220, 190]],
  "Mouse": [[200, 190, 185], [160, 150, 145], [250, 200, 200]],
  "Canary": [[255, 220, 50], [230, 180, 30], [255, 250, 200]],
  "Budgie": [[120, 200, 220], [80, 160, 200], [255, 255, 200]],
  "Cockatiel": [[200, 180, 120], [140, 120, 80], [255, 220, 100]],
  "Bearded Dragon": [[210, 160, 80], [160, 110, 50], [240, 200, 130]],
  "Corn Snake": [[220, 160, 80], [200, 80, 60], [250, 220, 180]],
  "Leopard Gecko": [[255, 220, 120], [180, 130, 60], [240, 200, 130]],
  "Betta Fish": [[200, 60, 120], [140, 40, 90], [120, 180, 220]],
  "Koi Fish": [[255, 140, 30], [225, 225, 230], [40, 40, 40]],
  "Hedgehog": [[150, 120, 90], [100, 80, 60], [230, 210, 190]],
  "Sugar Glider": [[160, 130, 110], [120, 95, 80], [240, 230, 220]],
  "Pot-Bellied Pig": [[120, 90, 80], [90, 65, 55], [180, 150, 140]],
  "Mini Goat": [[240, 230, 220], [180, 160, 140], [60, 50, 40]],
  "Chick": [[255, 220, 80], [255, 180, 40], [255, 180, 60]],
  "Duckling": [[255, 220, 80], [255, 180, 40], [255, 160, 50]],
  "Tarantula": [[100, 70, 50], [70, 45, 30], [160, 120, 90]],
  "Snail": [[180, 150, 100], [140, 110, 70], [220, 200, 160]],
  "Iguana": [[100, 160, 70], [60, 120, 50], [180, 200, 100]],
  "Finch": [[180, 130, 80], [120, 80, 50], [240, 220, 180]],

  # ---- Birds ----
  "Eagle": [[110, 90, 70], [80, 65, 50], [200, 180, 150]],
  "Owl": [[150, 120, 90], [100, 80, 60], [220, 200, 170]],
  "Flamingo": [[255, 130, 160], [255, 100, 140], [255, 180, 200]],
  "Peacock": [[40, 120, 100], [255, 180, 50], [60, 40, 120]],
  "Penguin": [[40, 40, 50], [215, 215, 220], [240, 180, 60]],
  "Hummingbird": [[80, 180, 120], [120, 200, 220], [255, 180, 50]],
  "Robin": [[200, 100, 70], [120, 80, 60], [230, 220, 200]],
  "Sparrow": [[150, 120, 90], [100, 80, 60], [200, 185, 165]],
  "Cardinal": [[210, 50, 50], [160, 30, 30], [220, 180, 100]],
  "Blue Jay": [[80, 130, 200], [255, 255, 255], [40, 40, 40]],
  "Woodpecker": [[200, 60, 50], [40, 30, 30], [230, 220, 200]],
  "Kingfisher": [[60, 130, 180], [255, 120, 50], [200, 220, 240]],
  "Pelican": [[180, 170, 160], [120, 110, 100], [220, 210, 200]],
  "Seagull": [[180, 185, 195], [120, 125, 135], [255, 180, 50]],
  "Stork": [[200, 200, 205], [150, 150, 155], [200, 60, 50]],
  "Crane": [[200, 200, 205], [150, 150, 155], [200, 60, 50]],
  "Heron": [[80, 110, 130], [50, 70, 90], [180, 190, 200]],
  "Swan": [[215, 215, 218], [180, 180, 185], [255, 150, 50]],
  "Goose": [[150, 120, 90], [100, 80, 60], [220, 200, 170]],
  "Duck": [[40, 100, 50], [255, 200, 50], [60, 40, 30]],
  "Rooster": [[180, 50, 50], [255, 180, 50], [50, 50, 50]],
  "Hen": [[160, 120, 90], [120, 90, 60], [220, 200, 170]],
  "Turkey": [[120, 80, 60], [150, 50, 50], [200, 170, 100]],
  "Ostrich": [[90, 80, 75], [60, 50, 45], [200, 180, 150]],
  "Toucan": [[30, 30, 35], [255, 150, 30], [255, 220, 50]],
  "Vulture": [[100, 80, 70], [70, 55, 45], [200, 180, 160]],
  "Falcon": [[120, 100, 80], [80, 65, 50], [200, 185, 165]],
  "Hawk": [[130, 100, 70], [90, 70, 45], [200, 180, 150]],

  # ---- Mandala Art ----
  "Flower Mandala": [[220, 80, 120], [255, 180, 50], [120, 180, 80]],
  "Geometric Mandala": [[80, 130, 200], [255, 140, 50], [150, 100, 200]],
  "Lotus Mandala": [[255, 150, 180], [200, 100, 150], [255, 220, 100]],
  "Sun Mandala": [[255, 180, 40], [255, 120, 30], [255, 230, 100]],
  "Star Mandala": [[100, 150, 220], [255, 220, 80], [200, 100, 220]],
  "Celtic Mandala": [[60, 130, 80], [180, 140, 60], [200, 200, 180]],
  "Zen Mandala": [[120, 180, 160], [80, 140, 130], [200, 220, 200]],
  "Peacock Mandala": [[40, 120, 100], [255, 180, 50], [80, 50, 120]],
  "Moon Mandala": [[180, 190, 220], [120, 130, 170], [220, 230, 250]],
  "Leaf Mandala": [[80, 160, 70], [50, 110, 40], [180, 210, 120]],
  "Spiral Mandala": [[200, 100, 180], [100, 150, 220], [255, 200, 80]],
  "Butterfly Mandala": [[255, 130, 60], [100, 150, 220], [255, 220, 100]],
  "Ocean Mandala": [[60, 130, 180], [40, 90, 150], [120, 180, 220]],
  "Fire Mandala": [[220, 60, 30], [255, 140, 30], [255, 200, 50]],
  "Crystal Mandala": [[150, 200, 240], [100, 160, 220], [200, 230, 250]],
  "Tribal Mandala": [[140, 80, 50], [200, 150, 80], [80, 50, 30]],
  "Cosmic Mandala": [[80, 50, 120], [200, 100, 200], [255, 200, 100]],
  "Garden Mandala": [[120, 180, 80], [255, 150, 180], [255, 220, 100]],
  "Snowflake Mandala": [[180, 210, 240], [120, 160, 200], [220, 235, 250]],
  "Heart Mandala": [[220, 60, 80], [255, 130, 150], [180, 40, 60]],
  "Phoenix Mandala": [[255, 100, 30], [220, 50, 30], [255, 200, 50]],
  "Dragon Mandala": [[60, 140, 60], [40, 100, 40], [120, 180, 80]],
  "Eagle Mandala": [[140, 100, 70], [90, 70, 50], [200, 180, 150]],
  "Elephant Mandala": [[130, 120, 110], [100, 90, 80], [170, 160, 150]],
  "Lion Mandala": [[200, 160, 80], [160, 120, 50], [240, 220, 180]],
  "Tree of Life Mandala": [[80, 140, 60], [120, 80, 40], [180, 210, 120]],
  "Wave Mandala": [[60, 140, 200], [40, 100, 160], [120, 190, 230]],
  "Desert Mandala": [[220, 180, 110], [180, 140, 80], [240, 220, 170]],
  "Rainbow Mandala": [[220, 60, 60], [255, 180, 40], [80, 160, 80]],
  "Galaxy Mandala": [[60, 40, 100], [200, 100, 200], [100, 150, 220]],

  # ---- Musical Instruments ----
  "Guitar": [[160, 100, 50], [120, 80, 40], [200, 170, 120]],
  "Piano": [[30, 30, 35], [230, 230, 235], [200, 180, 140]],
  "Violin": [[150, 90, 40], [110, 70, 30], [200, 160, 100]],
  "Drums": [[180, 50, 40], [60, 60, 70], [240, 240, 240]],
  "Trumpet": [[255, 200, 50], [200, 150, 30], [255, 230, 150]],
  "Saxophone": [[255, 215, 0], [200, 165, 0], [255, 235, 100]],
  "Flute": [[200, 200, 210], [150, 150, 165], [240, 240, 250]],
  "Cello": [[140, 80, 30], [100, 60, 20], [190, 140, 80]],
  "Clarinet": [[40, 40, 40], [180, 140, 60], [80, 80, 80]],
  "Banjo": [[200, 170, 100], [120, 90, 50], [240, 230, 210]],
  "Harp": [[255, 215, 100], [200, 170, 60], [230, 230, 240]],
  "Accordion": [[120, 50, 80], [60, 30, 50], [200, 180, 150]],
  "Trombone": [[220, 220, 230], [170, 170, 185], [250, 250, 255]],
  "Xylophone": [[200, 80, 60], [80, 160, 80], [60, 120, 200]],
  "Tambourine": [[180, 130, 60], [220, 200, 100], [140, 100, 40]],
  "Maracas": [[200, 150, 80], [150, 110, 60], [230, 200, 150]],
  "Harmonica": [[60, 60, 70], [180, 180, 190], [100, 100, 110]],
  "Oboe": [[40, 40, 40], [180, 160, 60], [80, 80, 80]],
  "Bassoon": [[60, 50, 35], [180, 160, 60], [100, 85, 60]],
  "Tuba": [[255, 200, 50], [200, 150, 30], [255, 230, 150]],
  "French Horn": [[255, 200, 50], [200, 150, 30], [255, 230, 150]],
  "Keyboard": [[30, 30, 35], [230, 230, 235], [180, 180, 190]],
  "Ukulele": [[180, 120, 50], [140, 90, 30], [220, 180, 120]],
  "Mandolin": [[150, 90, 40], [110, 70, 30], [200, 160, 100]],
  "Sitar": [[120, 80, 40], [80, 60, 30], [180, 140, 80]],
  "Bongos": [[160, 80, 50], [220, 190, 140], [100, 50, 30]],
  "Conga": [[120, 70, 40], [230, 210, 170], [80, 50, 25]],
  "Triangle": [[200, 200, 210], [160, 160, 175], [240, 240, 250]],
  "Castanets": [[160, 100, 50], [120, 80, 40], [200, 160, 100]],
  "Didgeridoo": [[140, 80, 40], [100, 60, 25], [190, 140, 80]],

  # ---- Indian Mythology and Gods ----
  "Ganesha": [[255, 180, 50], [220, 80, 40], [255, 230, 120]],
  "Krishna": [[80, 130, 200], [255, 200, 50], [180, 220, 255]],
  "Shiva": [[80, 140, 180], [255, 255, 255], [180, 80, 60]],
  "Durga": [[220, 50, 60], [255, 180, 40], [160, 30, 30]],
  "Hanuman": [[200, 140, 60], [220, 60, 40], [255, 200, 100]],
  "Lakshmi": [[255, 180, 40], [230, 50, 100], [255, 230, 150]],
  "Saraswati": [[255, 255, 255], [255, 180, 40], [180, 200, 240]],
  "Vishnu": [[80, 130, 200], [255, 200, 50], [255, 140, 30]],
  "Rama": [[80, 140, 200], [220, 180, 80], [255, 200, 50]],
  "Kali": [[40, 40, 50], [180, 30, 30], [120, 120, 130]],
  "Brahma": [[255, 180, 50], [220, 80, 40], [255, 230, 120]],
  "Kartikeya": [[220, 80, 40], [255, 180, 50], [120, 150, 200]],
  "Radha Krishna": [[80, 130, 200], [255, 150, 180], [255, 200, 50]],
  "Sita": [[255, 200, 220], [255, 180, 40], [200, 80, 100]],
  "Arjuna": [[180, 130, 60], [220, 60, 40], [255, 200, 100]],
  "Ravana": [[40, 40, 50], [180, 30, 30], [120, 120, 130]],
  "Garuda": [[255, 180, 40], [220, 80, 40], [255, 230, 120]],
  "Nandi Bull": [[200, 160, 80], [160, 120, 50], [240, 220, 180]],
  "Dwarka Temple": [[220, 180, 100], [180, 130, 60], [255, 220, 150]],
  "Kailash": [[180, 200, 220], [120, 140, 170], [220, 230, 245]],
  "Chariot of Sun God": [[255, 180, 40], [220, 80, 40], [255, 230, 120]],
  "Trishul": [[200, 200, 210], [150, 150, 165], [240, 240, 250]],
  "Lotus Pond Temple": [[220, 100, 150], [80, 160, 80], [255, 230, 150]],
  "Diya Lamp": [[255, 160, 40], [220, 80, 30], [255, 220, 100]],
  "Om Symbol": [[255, 150, 40], [220, 80, 40], [255, 220, 120]],
  "Peacock Throne": [[40, 120, 100], [255, 180, 50], [80, 50, 120]],
  "Snake God Vasuki": [[80, 140, 60], [40, 100, 40], [180, 200, 100]],
  "Goddess Ganga": [[100, 160, 220], [60, 120, 180], [180, 220, 250]],
  "Ashoka Tree": [[255, 180, 40], [80, 140, 60], [255, 100, 60]],
  "Kalpavriksha Tree": [[80, 140, 60], [255, 180, 40], [120, 80, 40]],

  # ---- Indian Mythology: 15 new items (pages 31-45) ----
  "Indra Deva": [[255, 180, 40], [80, 130, 200], [220, 80, 40]],
  "Agni Deva": [[220, 60, 30], [255, 140, 30], [255, 200, 50]],
  "Vayu Deva": [[150, 200, 230], [100, 160, 200], [200, 230, 250]],
  "Varuna Deva": [[60, 120, 180], [40, 90, 150], [120, 180, 220]],
  "Surya Deva": [[255, 180, 40], [255, 120, 30], [255, 230, 120]],
  "Chandra Deva": [[200, 210, 230], [150, 170, 200], [230, 235, 245]],
  "Yama Deva": [[80, 50, 60], [180, 30, 30], [120, 90, 100]],
  "Kubera Deva": [[255, 200, 50], [220, 160, 30], [255, 230, 150]],
  "Rudra": [[100, 130, 160], [60, 80, 100], [160, 190, 220]],
  "Parvati": [[255, 180, 200], [200, 100, 150], [255, 220, 230]],
  "Savitri": [[255, 200, 80], [220, 140, 40], [255, 230, 150]],
  "Gayatri": [[255, 255, 255], [255, 180, 40], [200, 220, 240]],
  "Tulsi Plant": [[80, 160, 70], [50, 110, 40], [180, 220, 120]],
  "Banyan Tree": [[120, 90, 50], [80, 60, 30], [180, 150, 100]],
  "Kamadhenu Cow": [[240, 230, 220], [180, 160, 140], [60, 50, 40]],

  # ---- Shiva Avatars ----
  "Nataraja Shiva": [[80, 140, 180], [255, 180, 40], [220, 60, 40]],
  "Ardhanarishvara Shiva": [[80, 140, 180], [255, 150, 180], [255, 255, 255]],
  "Bhairava Shiva": [[60, 40, 50], [180, 30, 30], [120, 90, 100]],

  # ---- Vishnu Avatars ----
  "Matsya Avatar Vishnu": [[80, 130, 200], [255, 160, 50], [180, 220, 255]],
  "Kurma Avatar Vishnu": [[80, 130, 200], [120, 100, 60], [180, 220, 255]],
  "Narasimha Avatar Vishnu": [[255, 160, 40], [220, 60, 30], [180, 100, 40]],
  "Varaha Avatar Vishnu": [[80, 130, 200], [120, 80, 50], [180, 220, 255]],
  "Vamana Avatar Vishnu": [[80, 130, 200], [255, 180, 40], [180, 220, 255]],
  "Parashurama Avatar Vishnu": [[80, 130, 200], [140, 100, 50], [220, 60, 40]],
  "Mahabali": [[255, 180, 40], [220, 80, 40], [255, 230, 120]],
  "Karthikeya on Peacock": [[220, 80, 40], [40, 120, 100], [255, 180, 50]],
  "Mohini Avatar Vishnu": [[255, 150, 180], [255, 180, 40], [200, 100, 150]],

  # ---- Food ----
  "Omelette": [[255, 220, 100], [255, 180, 60], [180, 130, 50]],
  "Waffles": [[220, 170, 90], [180, 130, 60], [255, 200, 120]],
  "Fried Chicken": [[220, 160, 80], [180, 120, 50], [240, 200, 140]],
  "Hot Dog": [[220, 80, 60], [255, 220, 160], [140, 90, 50]],
  "Croissant": [[230, 190, 120], [190, 150, 80], [245, 220, 170]],
  "Red Velvet Cupcake": [[180, 50, 60], [255, 240, 240], [255, 180, 200]],
  "Baklava": [[230, 190, 100], [180, 140, 60], [255, 220, 150]],
  "Grilled Bacon": [[200, 80, 50], [160, 50, 30], [240, 180, 130]],
  "Fish and Chips": [[255, 200, 100], [220, 160, 60], [255, 230, 150]],
  "Samosa": [[220, 170, 90], [180, 130, 60], [240, 200, 130]],

  # ---- World Landmarks ----
  "Eiffel Tower": [[140, 130, 110], [100, 90, 75], [180, 170, 150]],
  "Big Ben": [[140, 120, 90], [100, 85, 60], [180, 160, 120]],
  "Taj Mahal": [[240, 240, 245], [200, 190, 180], [180, 160, 120]],
  "Pyramids of Giza": [[220, 190, 120], [180, 150, 80], [245, 220, 160]],
  "Statue of Liberty": [[80, 150, 130], [50, 110, 95], [130, 190, 170]],
  "Colosseum": [[180, 150, 110], [140, 110, 75], [220, 195, 160]],
  "Sydney Opera House": [[240, 245, 250], [180, 200, 220], [100, 150, 200]],
  "Great Wall of China": [[160, 130, 90], [120, 95, 60], [200, 175, 130]],
  "Leaning Tower of Pisa": [[230, 220, 200], [190, 175, 150], [250, 240, 225]],
  "Christ the Redeemer": [[220, 220, 225], [170, 170, 180], [120, 150, 200]],
  "Stonehenge": [[160, 155, 145], [120, 115, 105], [200, 195, 185]],
  "Mount Rushmore": [[170, 160, 145], [130, 120, 105], [210, 200, 185]],
  "Burj Khalifa": [[180, 200, 220], [130, 160, 200], [220, 235, 250]],
  "Golden Gate Bridge": [[220, 70, 30], [180, 50, 20], [255, 140, 90]],
  "Tower Bridge": [[180, 140, 60], [130, 100, 40], [220, 190, 100]],
  "Machu Picchu": [[150, 130, 100], [110, 95, 70], [200, 180, 145]],
  "Petra": [[200, 130, 80], [160, 95, 50], [240, 180, 130]],
  "Parthenon": [[230, 225, 210], [190, 180, 160], [250, 245, 235]],
  "St Basil Cathedral": [[220, 80, 60], [80, 130, 200], [255, 200, 50]],
  "Neuschwanstein Castle": [[200, 200, 220], [120, 100, 80], [80, 130, 180]],
  "CN Tower": [[180, 180, 190], [120, 120, 135], [220, 220, 235]],
  "Hollywood Sign": [[255, 255, 255], [120, 90, 60], [100, 130, 80]],
  "Easter Island Moai": [[140, 130, 115], [100, 90, 75], [180, 170, 150]],
  "Angkor Wat": [[180, 150, 90], [130, 110, 60], [220, 195, 140]],
  "Hagia Sophia": [[200, 180, 130], [150, 130, 80], [240, 225, 190]],
  "Mont Saint Michel": [[220, 215, 200], [150, 140, 120], [120, 150, 200]],
  "Sagrada Familia": [[220, 190, 120], [170, 140, 80], [250, 230, 180]],
  "Chichen Itza": [[190, 165, 110], [140, 120, 75], [230, 210, 165]],
  "Tokyo Tower": [[230, 70, 40], [180, 50, 25], [255, 150, 110]],
  "Forbidden City": [[200, 50, 40], [255, 200, 50], [140, 80, 30]],
  "Acropolis": [[220, 210, 190], [170, 160, 140], [250, 240, 225]],
  "Edinburgh Castle": [[130, 110, 90], [90, 75, 55], [170, 150, 125]],
  "Buckingham Palace": [[220, 200, 160], [160, 130, 80], [250, 235, 210]],
  "White House": [[245, 245, 240], [180, 180, 170], [120, 100, 70]],
  "Niagara Falls": [[100, 160, 210], [60, 120, 180], [180, 220, 245]],
  "Grand Canyon": [[200, 130, 70], [160, 95, 50], [240, 180, 120]],
  "Northern Lights": [[80, 200, 150], [100, 120, 220], [180, 100, 200]],
  "Forbidden City Gate": [[200, 50, 40], [255, 200, 50], [140, 80, 30]],
  "Trevi Fountain": [[220, 215, 200], [150, 150, 165], [100, 150, 200]],
  "Pompeii Ruins": [[180, 150, 110], [130, 105, 70], [220, 195, 155]],

  # ---- Unicorns & Fairies ----
  "Unicorn Rainbow": [[255, 180, 220], [255, 220, 100], [180, 200, 255]],
  "Fairy Garden": [[120, 180, 80], [255, 180, 220], [255, 220, 100]],
  "Pegasus Cloud Castle": [[200, 220, 255], [255, 255, 255], [200, 150, 220]],
}

# ---------------------------------------------------------------------------
# 30-COLOR FALLBACK PALETTE for items without a natural color
# (vehicles, some fantasy, some space). Deterministic offset per item name.
# ---------------------------------------------------------------------------


# ─────────────────────────────────────────────────────────────────────────────
# 30-COLOR FALLBACK PALETTE for items without a natural color.
# Deterministic offset per item name (so each item gets consistent colors).
# ─────────────────────────────────────────────────────────────────────────────
FALLBACK_PALETTE: Palette = [
    (231, 76, 60),
    (230, 126, 34),
    (241, 196, 15),
    (46, 204, 113),
    (26, 188, 156),
    (52, 152, 219),
    (155, 89, 182),
    (236, 240, 241),
    (149, 165, 166),
    (52, 73, 94),
    (255, 118, 117),
    (255, 165, 89),
    (255, 215, 100),
    (100, 220, 150),
    (100, 220, 220),
    (100, 170, 255),
    (200, 140, 230),
    (255, 180, 180),
    (180, 220, 255),
    (200, 240, 200),
    (255, 200, 150),
    (200, 255, 220),
    (240, 200, 255),
    (255, 240, 180),
    (180, 200, 180),
    (220, 180, 140),
    (255, 150, 200),
    (150, 200, 255),
    (255, 180, 100),
    (180, 255, 180),
]

# ─────────────────────────────────────────────────────────────────────────────
# Deterministic string hash → offset into fallback palette
# ─────────────────────────────────────────────────────────────────────────────
def _hash_string(s: str) -> int:
    h = 0
    for ch in s:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h


# ─────────────────────────────────────────────────────────────────────────────
# NO-WHITE RULE — palettes may not contain white/near-white colors.
# White fur → light grey/beige/pink; white feathers → cream/tan; etc.
# The sanitizer enforces this at runtime — any palette (natural or fallback)
# is passed through `sanitize_palette()` which replaces any near-white entry
# with a safe light tint.
# ─────────────────────────────────────────────────────────────────────────────
WHITE_THRESHOLD = 230  # any RGB channel >= this in ALL 3 channels = near-white

# Light-tint substitutions for white. Cycled deterministically so repeated
# white entries in the same palette get variety (grey, beige, pink, blue…).
WHITE_SUBSTITUTES: list[RGB] = [
    (200, 200, 205),  # light grey (fur shadow)
    (230, 218, 195),  # beige/cream (feathers)
    (255, 200, 205),  # blush pink (inner ear, nose)
    (205, 222, 238),  # pale blue (sky/snow tint)
    (220, 210, 230),  # pale lavender
    (235, 225, 200),  # light tan
]


def _is_near_white(c: RGB, threshold: int = WHITE_THRESHOLD) -> bool:
    return c[0] >= threshold and c[1] >= threshold and c[2] >= threshold


def sanitize_palette(palette: Palette, seed_name: str = "") -> Palette:
    """Replace any white/near-white color in a palette with a visible light tint."""
    sub_idx = 0
    if seed_name:
        sub_idx = _hash_string(seed_name) % len(WHITE_SUBSTITUTES)
    result: Palette = []
    for c in palette:
        if _is_near_white(c):
            sub = WHITE_SUBSTITUTES[sub_idx % len(WHITE_SUBSTITUTES)]
            sub_idx += 1
            result.append(sub)
        else:
            result.append(c)
    return result


def get_palette(item: str, category: str) -> Palette:
    """Return the color palette for an item — natural palette wins, always sanitized."""
    if item in NATURAL_PALETTES:
        return sanitize_palette([tuple(c) for c in NATURAL_PALETTES[item]], item)
    # Fallback: rotated 30-color palette with deterministic offset
    offset = _hash_string(item) % len(FALLBACK_PALETTE)
    rotated = [FALLBACK_PALETTE[(i + offset) % len(FALLBACK_PALETTE)] for i in range(len(FALLBACK_PALETTE))]
    return sanitize_palette(rotated, item)


# ─────────────────────────────────────────────────────────────────────────────
# PDF page layout constants (exact spec — DO NOT CHANGE).
# Match src/lib/coloring-data.ts exactly so PDFs are byte-identical in layout.
# ─────────────────────────────────────────────────────────────────────────────
# KDP minimum margins: 0.4 inches (28.8pt) for top, bottom, and outside.
PAGE_WIDTH = 612        # 8.5 inches @ 72 dpi
PAGE_HEIGHT = 792       # 11 inches @ 72 dpi
MARGIN = 36             # 0.5 inches (general page margin)
KDP_MARGIN = 29         # 0.4 inches (KDP minimum, 28.8pt rounded)
REF_SIZE = 86           # colored reference 86×86
REF_X = KDP_MARGIN      # 29 (0.4" from left — KDP compliant)
REF_Y = KDP_MARGIN      # 29 (0.4" from top — KDP compliant)
BW_SIZE = 380           # B&W coloring 380×380
BW_X = (PAGE_WIDTH - BW_SIZE) // 2  # 116
BW_Y = 132              # below reference
TITLE_Y = 527           # below the B&W image
PAGE_NUM_X = 546        # right-aligned
PAGE_NUM_Y = 740        # bottom-right

BLANK_PAGE_WIDTH = 612
BLANK_PAGE_HEIGHT = 792
