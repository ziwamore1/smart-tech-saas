import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const subjects = [
  { code: '1021', name: 'English Language' },
  { code: '1025', name: 'Literature in English' },
  { code: '3011', name: 'Civic Education' },
  { code: '3012', name: 'Religious Education' },
  { code: '3013', name: 'History' },
  { code: '3014', name: 'Geography' },
  { code: '1120', name: 'French Language' },
  { code: '1125', name: 'Chinese Language' },
  { code: '1211', name: 'Zambian Languages' },
  { code: '1321', name: 'Literature in Zambian Languages' },
  { code: '2021', name: 'Mathematics I' },
  { code: '2025', name: 'Mathematics II' },
  { code: '4018', name: 'Agricultural Science' },
  { code: '4016', name: 'Physics' },
  { code: '4014', name: 'Chemistry' },
  { code: '4012', name: 'Biology' },
  { code: '5012', name: 'Art and Design' },
  { code: '5014', name: 'Musical Arts' },
  { code: '8015', name: 'Design and Technology' },
  { code: '6012', name: 'Fashion and Fabrics' },
  { code: '6014', name: 'Food and Nutrition' },
  { code: '6015', name: 'Hospitality Management' },
  { code: '6016', name: 'Travel and Tourism' },
  { code: '9010', name: 'Physical Education and Sport' },
  { code: '8010', name: 'Computer Science' },
  { code: '8011', name: 'Information and Communications Technology' },
  { code: '7015', name: 'Commerce' },
  { code: '7020', name: 'Principles of Accounts' },
];

const eocs: Record<string, { name: string; construct: string }[]> = {
  'English Language': [
    { name: 'Interprets and understands spoken information', construct: 'Listening comprehension' },
    { name: 'Produces ideas, thoughts and opinions through spoken language', construct: 'Speaking production' },
    { name: 'Reads, Interprets and summarises continuous and non-continuous texts', construct: 'Reading comprehension' },
    { name: 'Demonstrates masterly of written language conventions', construct: 'Writing production' },
  ],
  'Literature in English': [
    { name: 'Acquires literary skills and uses them in everyday life', construct: 'Literary skills' },
    { name: 'Analyses and applies the elements of the literary genre of poetry', construct: 'Poetry analysis' },
    { name: 'Analyses and applies the elements of the literary genre of drama', construct: 'Drama analysis' },
    { name: 'Analyses and applies elements of the literary genre of prose', construct: 'Prose analysis' },
  ],
  'Civic Education': [
    { name: 'Demonstrates patriotism and good citizenry', construct: 'Patriotism and citizenry' },
    { name: 'Utilises resources to foster personal and national development', construct: 'Resource utilisation' },
    { name: 'Resolves conflict and Collaborates with others in local, regional and international affairs to promote national development', construct: 'Conflict resolution and collaboration' },
    { name: 'Exhibits principles, good morals and values in day to day life', construct: 'Morals and values' },
  ],
  'Religious Education': [
    { name: 'Demonstrates understanding of growth, friendship and family as basis for human existence', construct: 'Growth, friendship and family' },
    { name: 'Demonstrates understanding of spirituality, faith and prayer as commitment to God', construct: 'Spirituality and faith' },
    { name: 'Applies national values and principles in the community', construct: 'National values' },
    { name: 'Demonstrates understanding of man\'s attitude to Life and work', construct: 'Attitude to life and work' },
    { name: 'Demonstrates understanding of order, leadership and freedom in society', construct: 'Order, leadership and freedom' },
  ],
  'History': [
    { name: 'Demonstrates understanding of ideologies of Evolution and early civilisation', construct: 'Evolution and early civilisation' },
    { name: 'Appreciates historical sites and traditional practices', construct: 'Historical sites and traditions' },
    { name: 'Exhibits good morals, principles and national values', construct: 'Morals and national values' },
    { name: 'Promotes national patriotism and citizenship through historical events while fostering collaboration with local, regional and international communities', construct: 'Patriotism and collaboration' },
    { name: 'Analyses emerging global issues and their sustainability', construct: 'Global issues and sustainability' },
  ],
  'Geography': [
    { name: 'Applies map reading skills to understand spatial relationships in real life', construct: 'Map reading' },
    { name: 'Demonstrates understanding of earth\'s natural processes and their effects', construct: 'Natural processes' },
    { name: 'Understands demographic dynamics and its relationship with the environment and humanity in order to identify strategies for sustainable development', construct: 'Demographic dynamics' },
    { name: 'Demonstrates understanding of resource utilisation and sustainability', construct: 'Resource utilisation and sustainability' },
    { name: 'Conducts geographical inquiry using appropriate research methods', construct: 'Geographical inquiry' },
  ],
  'French Language': [
    { name: 'Reads, interprets, summarises and translates continuous and non-continuous texts', construct: 'Reading and translation' },
    { name: 'Demonstrates mastery of written language conventions and transformations', construct: 'Written language mastery' },
    { name: 'Understands and interprets spoken information', construct: 'Listening comprehension' },
    { name: 'Produces ideas, thoughts and opinions through spoken language', construct: 'Speaking production' },
  ],
  'Chinese Language': [
    { name: 'Reads, interprets, summarises and translates continuous and non-continuous texts', construct: 'Reading and translation' },
    { name: 'Demonstrates mastery of written language conventions and transformations', construct: 'Written language mastery' },
    { name: 'Understands and interprets spoken information', construct: 'Listening comprehension' },
    { name: 'Produces ideas, thoughts and opinions through spoken language', construct: 'Speaking production' },
  ],
  'Zambian Languages': [
    { name: 'Demonstrates masterly of written language conventions', construct: 'Written language conventions' },
    { name: 'Interprets, summarises and translates continuous and non-continuous texts', construct: 'Interpretation and translation' },
    { name: 'Interprets and understands spoken information', construct: 'Listening comprehension' },
    { name: 'Expresses ideas, thoughts and opinions through spoken language', construct: 'Speaking expression' },
  ],
  'Literature in Zambian Languages': [
    { name: 'Demonstrates understanding of types and functions of literature and literary skills, and uses them to educate, entertain, preserve culture and create entrepreneurial opportunities', construct: 'Literary understanding' },
    { name: 'Analyses or Composes Various Types of Poetry', construct: 'Poetry analysis and composition' },
    { name: 'Analyses and Composes Prose', construct: 'Prose analysis and composition' },
    { name: 'Analyses and Composes Various Types of Drama', construct: 'Drama analysis and composition' },
  ],
  'Mathematics I': [
    { name: 'Performs operations on numbers to solve real life problems', construct: 'Number operations' },
    { name: 'Models real life situations to make informed decisions', construct: 'Algebraic modelling' },
    { name: 'Analyses and applies spatial relationships to solve real life problems', construct: 'Spatial relationships and geometry' },
    { name: 'Interprets and computes measures to solve real life problems', construct: 'Measurement' },
    { name: 'Presents and interprets data to make informed decisions', construct: 'Data interpretation' },
  ],
  'Mathematics II': [
    { name: 'Interprets and computes relationships of numbers within and across different number systems', construct: 'Number relationships' },
    { name: 'Models real life situations to solve problems and make informed decisions', construct: 'Algebraic modelling' },
    { name: 'Computes measures and applies spatial relationships to solve real life problems', construct: 'Measures and spatial relationships' },
    { name: 'Interprets and computes functions to solve real life situations in order to make informed decisions', construct: 'Functions' },
    { name: 'Presents and analyses data to make informed decisions', construct: 'Data analysis' },
  ],
  'Agricultural Science': [
    { name: 'Investigates agricultural scientific problem through observations, measurement, experimentation and recording', construct: 'Scientific investigation' },
    { name: 'Demonstrates practical skills in managing crops for improved yields', construct: 'Crop management' },
    { name: 'Applies practical skills in managing livestock for improved production', construct: 'Livestock management' },
    { name: 'Analyses data and applies sustainable scientific techniques for improved productivity', construct: 'Data analysis and sustainability' },
    { name: 'Applies agribusiness and entrepreneurship skills in managing farm enterprises', construct: 'Agribusiness and entrepreneurship' },
    { name: 'Investigates agricultural problems and demonstrates practical skills in real life situations', construct: 'Integrated agricultural problem solving' },
  ],
  'Physics': [
    { name: 'Classifies and applies Physical quantities and their measurements in handling of materials and objects', construct: 'Physical quantities and measurement' },
    { name: 'Analyses and applies principles of mechanical systems to maximize the benefits of their performance', construct: 'Mechanical systems' },
    { name: 'Applies and interprets concepts of thermal properties of matter', construct: 'Thermal properties' },
    { name: 'Interprets and applies properties of waves to predict natural phenomena and design appropriate technologies', construct: 'Waves' },
    { name: 'Analyses and manipulates electric and magnetic properties of materials', construct: 'Electricity and magnetism' },
    { name: 'Applies electronic, communication, nuclear, and renewable energy principles', construct: 'Electronics and nuclear physics' },
  ],
  'Chemistry': [
    { name: 'Classifies substances and interprets the physical and chemical changes of the substances for suitable application in life', construct: 'Substances and changes' },
    { name: 'Analyses and identifies chemical composition of substances for scientific decision making', construct: 'Chemical analysis' },
    { name: 'Evaluates industrial chemical processes and suggests alternative methods of production that are sustainable and environmentally safe', construct: 'Industrial chemistry' },
    { name: 'Applies Chemistry principles and mathematical operations to determine quantities of reactants or products', construct: 'Quantitative chemistry' },
    { name: 'Investigates quantities involving industrial processes', construct: 'Industrial stoichiometry' },
    { name: 'Applies Chemistry principles in everyday life', construct: 'Applied chemistry' },
  ],
  'Biology': [
    { name: 'Analyses Systems of Classifying Organisms and Substances', construct: 'Classification' },
    { name: 'Investigates and Explains Biological Functions', construct: 'Biological functions' },
    { name: 'Interprets and Explains Scientific Evidence', construct: 'Scientific evidence' },
    { name: 'Applies Scientific Skills to Real-life Situations', construct: 'Scientific skills application' },
    { name: 'Demonstrates biological principles in real life situations', construct: 'Biological principles in practice' },
  ],
  'Art and Design': [
    { name: 'Demonstrates cultural heritage and craftsmanship', construct: 'Cultural heritage and craftsmanship' },
    { name: 'Illustrates technological and communicative art skills', construct: 'Technological and communicative art' },
    { name: 'Develops pictorial art compositions', construct: 'Pictorial composition' },
    { name: 'Applies creative art skills in craftsmanship for innovation and entrepreneurship', construct: 'Creative craftsmanship and entrepreneurship' },
  ],
  'Musical Arts': [
    { name: 'Analyses pitch', construct: 'Pitch analysis' },
    { name: 'Creates Melodies', construct: 'Melody creation' },
    { name: 'Arranges Musical Scores', construct: 'Musical arrangement' },
    { name: 'Applies Musical Knowledge and Skills to Generate Income', construct: 'Music entrepreneurship' },
    { name: 'Analyses World Music', construct: 'World music analysis' },
  ],
  'Design and Technology': [
    { name: 'Utilises various materials and techniques to produce items while adhering to safety procedures', construct: 'Materials and safety' },
    { name: 'Generates and develops graphical representations and models', construct: 'Graphical representation' },
    { name: 'Designs and constructs innovative systems', construct: 'Innovative systems' },
    { name: 'Develops and implements a business idea', construct: 'Entrepreneurship' },
  ],
  'Fashion and Fabrics': [
    { name: 'Makes informed choices and expresses innovative skills in the fashion industry', construct: 'Fashion industry awareness' },
    { name: 'Demonstrates technical knowledge and skills while promoting workplace safety', construct: 'Technical skills and safety' },
    { name: 'Develops habits and sense of responsibility in managing personal and social development', construct: 'Personal and social development' },
    { name: 'Demonstrates knowledge on the use, care and improvisation of tools and material in fashion industry', construct: 'Tools and materials' },
    { name: 'Expresses awareness of income generating opportunities for self-reliance and economic growth', construct: 'Entrepreneurship in fashion' },
  ],
  'Food and Nutrition': [
    { name: 'Explores the Kitchen, equipment, utensils and materials', construct: 'Kitchen skills' },
    { name: 'Understands Fundamentals of Food and Nutrition', construct: 'Food and nutrition fundamentals' },
    { name: 'Prepares and Serves Meals and Dishes', construct: 'Meal preparation and service' },
    { name: 'Innovates Food Packaging and Storage Solutions', construct: 'Food packaging and storage' },
    { name: 'Demonstrates Knowledge and Practices that Promote Sustainable Food Security', construct: 'Sustainable food security' },
    { name: 'Develops Skills in Consumers and Entrepreneurs through Research', construct: 'Consumer and entrepreneurial skills' },
  ],
  'Hospitality Management': [
    { name: 'Understands the history of hospitality', construct: 'Hospitality history' },
    { name: 'Delivers quality guest experience and coordinates effectively with other departments', construct: 'Guest experience and coordination' },
    { name: 'Demonstrates skills in food technology and preparation', construct: 'Food technology and preparation' },
    { name: 'Applies entrepreneurial skills in hospitality business', construct: 'Hospitality entrepreneurship' },
  ],
  'Travel and Tourism': [
    { name: 'Explores tourism dynamics, understand travellers\' destinations and global challenges in tourism', construct: 'Tourism dynamics' },
    { name: 'Manages tourism destinations and operations', construct: 'Destination management' },
    { name: 'Applies key principles of the hospitality industry in travel and tourism', construct: 'Hospitality in tourism' },
    { name: 'Operates tourism events and activities', construct: 'Tourism events' },
    { name: 'Conducts tour operations', construct: 'Tour operations' },
  ],
  'Physical Education and Sport': [
    { name: 'Understands health related activities in physical education', construct: 'Health related activities' },
    { name: 'Demonstrates motor activities in sports', construct: 'Motor activities' },
    { name: 'Understands human body and its movements', construct: 'Human body and movement' },
    { name: 'Applies entrepreneurial skills', construct: 'Sports entrepreneurship' },
    { name: 'Applies athletics skills management of sports events and facilities', construct: 'Sports management' },
  ],
  'Computer Science': [
    { name: 'Recognises computer system components to build and troubleshoot computer systems everyday life', construct: 'Computer systems' },
    { name: 'Analyses computer tools based on their roles in problem solving', construct: 'Computer tools analysis' },
    { name: 'Analyses computing concepts by identifying relationships, principles and underlying structures', construct: 'Computing concepts' },
    { name: 'Applies computational knowledge to critically evaluate situations and make informed technological decisions', construct: 'Computational evaluation' },
    { name: 'Creates and designs systems that solve real life problems and improve way of life for citizens', construct: 'System design and creation' },
  ],
  'Information and Communications Technology': [
    { name: 'Demonstrate the ability to identify and describe ICT components, systems and their functions', construct: 'ICT components and systems' },
    { name: 'Classify and distinguish ICT tools, file types, network structures, and technologies', construct: 'ICT tools and networks' },
    { name: 'Develops analytical skills and evaluating ICT systems and problems', construct: 'ICT analytical skills' },
    { name: 'Evaluate ICT systems, networks and technologies', construct: 'ICT systems evaluation' },
    { name: 'Applies ethical reasoning in the responsible use of ICT', construct: 'ICT ethics' },
  ],
  'Commerce': [
    { name: 'Demonstrates the skills of clean production and trading within legal parameters', construct: 'Production and trading' },
    { name: 'Demonstrates skills in entrepreneurship, Business formation and financing', construct: 'Entrepreneurship and business formation' },
    { name: 'Applies physical and Online Business practices free from exploitation', construct: 'Physical and online business' },
    { name: 'Analyses and evaluates the significance of commercial services in production, commerce and direct service provision', construct: 'Commercial services' },
  ],
  'Principles of Accounts': [
    { name: 'Demonstrates sound accounting decisions based on key accounting principles or concepts, procedures and ethical standards', construct: 'Accounting principles and ethics' },
    { name: 'Demonstrates proficiency in recording business transactions in ledger accounts', construct: 'Transaction recording' },
    { name: 'Analyses the effective implementation of reconciliation and verification tools in accounting', construct: 'Reconciliation and verification' },
    { name: 'Prepares and analyses financial statements', construct: 'Financial statements' },
  ],
};

const assessmentObjectives: Record<string, { name: string; weight: number }[]> = {
  'English Language': [
    { name: 'Listening comprehension (EoC 1)', weight: 25 },
    { name: 'Speaking production (EoC 2)', weight: 25 },
    { name: 'Reading comprehension and summary (EoC 3)', weight: 30 },
    { name: 'Writing conventions and composition (EoC 4)', weight: 20 },
  ],
  'Literature in English': [
    { name: 'Literary skills (EoC 1)', weight: 20 },
    { name: 'Poetry analysis (EoC 2)', weight: 25 },
    { name: 'Drama analysis (EoC 3)', weight: 25 },
    { name: 'Prose analysis (EoC 4)', weight: 30 },
  ],
  'Civic Education': [
    { name: 'Patriotism and good citizenry (EoC 1)', weight: 30 },
    { name: 'Resource utilisation (EoC 2)', weight: 20 },
    { name: 'Conflict resolution and collaboration (EoC 3)', weight: 25 },
    { name: 'Morals and values (EoC 4)', weight: 25 },
  ],
  'Religious Education': [
    { name: 'Growth, friendship and family (EoC 1)', weight: 20 },
    { name: 'Spirituality and faith (EoC 2)', weight: 20 },
    { name: 'National values (EoC 3)', weight: 20 },
    { name: 'Attitude to life and work (EoC 4)', weight: 20 },
    { name: 'Order, leadership and freedom (EoC 5)', weight: 20 },
  ],
  'History': [
    { name: 'Evolution and early civilisation (EoC 1)', weight: 20 },
    { name: 'Historical sites and traditions (EoC 2)', weight: 20 },
    { name: 'Morals and national values (EoC 3)', weight: 20 },
    { name: 'Patriotism and collaboration (EoC 4)', weight: 20 },
    { name: 'Global issues and sustainability (EoC 5)', weight: 20 },
  ],
  'Geography': [
    { name: 'Map reading (EoC 1)', weight: 25 },
    { name: 'Natural processes (EoC 2)', weight: 25 },
    { name: 'Demographic dynamics (EoC 3)', weight: 25 },
    { name: 'Resource utilisation and sustainability (EoC 4)', weight: 25 },
  ],
  'Mathematics I': [
    { name: 'Number operations (EoC 1)', weight: 20 },
    { name: 'Algebraic modelling (EoC 2)', weight: 20 },
    { name: 'Spatial relationships and geometry (EoC 3)', weight: 20 },
    { name: 'Measurement (EoC 4)', weight: 20 },
    { name: 'Data interpretation (EoC 5)', weight: 20 },
  ],
  'Mathematics II': [
    { name: 'Number relationships (EoC 1)', weight: 20 },
    { name: 'Algebraic modelling (EoC 2)', weight: 20 },
    { name: 'Measures and spatial relationships (EoC 3)', weight: 20 },
    { name: 'Functions (EoC 4)', weight: 20 },
    { name: 'Data analysis (EoC 5)', weight: 20 },
  ],
  'Physics': [
    { name: 'Physical quantities and measurement (EoC 1)', weight: 12.5 },
    { name: 'Mechanical systems (EoC 2)', weight: 17.5 },
    { name: 'Thermal properties (EoC 3)', weight: 17.5 },
    { name: 'Waves (EoC 4)', weight: 17.5 },
    { name: 'Electricity and magnetism (EoC 5)', weight: 17.5 },
    { name: 'Electronics and nuclear physics (EoC 6)', weight: 17.5 },
  ],
  'Chemistry': [
    { name: 'Substances and changes (EoC 1)', weight: 16 },
    { name: 'Chemical analysis (EoC 2)', weight: 16 },
    { name: 'Industrial chemistry (EoC 3)', weight: 16 },
    { name: 'Quantitative chemistry (EoC 4)', weight: 18 },
    { name: 'Industrial stoichiometry (EoC 5)', weight: 16 },
    { name: 'Applied chemistry (EoC 6)', weight: 18 },
  ],
  'Biology': [
    { name: 'Classification (EoC 1)', weight: 14 },
    { name: 'Biological functions (EoC 2)', weight: 29 },
    { name: 'Scientific evidence (EoC 3)', weight: 29 },
    { name: 'Scientific skills application (EoC 4)', weight: 28 },
  ],
  'Agricultural Science': [
    { name: 'Scientific investigation (EoC 1)', weight: 25 },
    { name: 'Crop management (EoC 2)', weight: 17 },
    { name: 'Livestock management (EoC 3)', weight: 17 },
    { name: 'Data analysis and sustainability (EoC 4)', weight: 25 },
    { name: 'Agribusiness and entrepreneurship (EoC 5)', weight: 16 },
  ],
  'Computer Science': [
    { name: 'Computer systems (EoC 1)', weight: 30 },
    { name: 'Computer tools analysis (EoC 2)', weight: 25 },
    { name: 'Computing concepts (EoC 3)', weight: 25 },
    { name: 'Computational evaluation (EoC 4)', weight: 10 },
    { name: 'System design and creation (EoC 5)', weight: 10 },
  ],
  'Commerce': [
    { name: 'Production and trading (EoC 1)', weight: 25 },
    { name: 'Entrepreneurship and business formation (EoC 2)', weight: 25 },
    { name: 'Physical and online business (EoC 3)', weight: 15 },
    { name: 'Commercial services (EoC 4)', weight: 35 },
  ],
  'Principles of Accounts': [
    { name: 'Accounting principles and ethics (EoC 1)', weight: 20 },
    { name: 'Transaction recording (EoC 2)', weight: 20 },
    { name: 'Reconciliation and verification (EoC 3)', weight: 20 },
    { name: 'Financial statements (EoC 4)', weight: 40 },
  ],
  'French Language': [
    { name: 'Reading and translation (EoC 1)', weight: 30 },
    { name: 'Written language mastery (EoC 2)', weight: 25 },
    { name: 'Listening comprehension (EoC 3)', weight: 25 },
    { name: 'Speaking production (EoC 4)', weight: 20 },
  ],
  'Chinese Language': [
    { name: 'Reading and translation (EoC 1)', weight: 30 },
    { name: 'Written language mastery (EoC 2)', weight: 25 },
    { name: 'Listening comprehension (EoC 3)', weight: 25 },
    { name: 'Speaking production (EoC 4)', weight: 20 },
  ],
  'Zambian Languages': [
    { name: 'Written language conventions (EoC 1)', weight: 30 },
    { name: 'Interpretation and translation (EoC 2)', weight: 30 },
    { name: 'Listening comprehension (EoC 3)', weight: 20 },
    { name: 'Speaking expression (EoC 4)', weight: 20 },
  ],
  'Literature in Zambian Languages': [
    { name: 'Literary understanding (EoC 1)', weight: 20 },
    { name: 'Poetry analysis and composition (EoC 2)', weight: 25 },
    { name: 'Prose analysis and composition (EoC 3)', weight: 30 },
    { name: 'Drama analysis and composition (EoC 4)', weight: 25 },
  ],
  'Art and Design': [
    { name: 'Cultural heritage and craftsmanship (EoC 1)', weight: 32 },
    { name: 'Technological and communicative art (EoC 2)', weight: 24 },
    { name: 'Pictorial composition (EoC 3)', weight: 27 },
    { name: 'Creative craftsmanship and entrepreneurship (EoC 4)', weight: 17 },
  ],
  'Musical Arts': [
    { name: 'Pitch analysis (EoC 1)', weight: 20 },
    { name: 'Melody creation (EoC 2)', weight: 20 },
    { name: 'Musical arrangement (EoC 3)', weight: 20 },
    { name: 'Music entrepreneurship (EoC 4)', weight: 20 },
    { name: 'World music analysis (EoC 5)', weight: 20 },
  ],
  'Design and Technology': [
    { name: 'Materials and safety (EoC 1)', weight: 27 },
    { name: 'Graphical representation (EoC 2)', weight: 33 },
    { name: 'Innovative systems (EoC 3)', weight: 27 },
    { name: 'Entrepreneurship (EoC 4)', weight: 13 },
  ],
  'Fashion and Fabrics': [
    { name: 'Fashion industry awareness (EoC 1)', weight: 17 },
    { name: 'Technical skills and safety (EoC 2)', weight: 25 },
    { name: 'Personal and social development (EoC 3)', weight: 17 },
    { name: 'Tools and materials (EoC 4)', weight: 24 },
    { name: 'Entrepreneurship in fashion (EoC 5)', weight: 17 },
  ],
  'Food and Nutrition': [
    { name: 'Kitchen skills (EoC 1)', weight: 17 },
    { name: 'Food and nutrition fundamentals (EoC 2)', weight: 17 },
    { name: 'Meal preparation and service (EoC 3)', weight: 17 },
    { name: 'Food packaging and storage (EoC 4)', weight: 17 },
    { name: 'Sustainable food security (EoC 5)', weight: 17 },
    { name: 'Consumer and entrepreneurial skills (EoC 6)', weight: 15 },
  ],
  'Hospitality Management': [
    { name: 'Hospitality history (EoC 1)', weight: 25 },
    { name: 'Guest experience and coordination (EoC 2)', weight: 25 },
    { name: 'Food technology and preparation (EoC 3)', weight: 25 },
    { name: 'Hospitality entrepreneurship (EoC 4)', weight: 25 },
  ],
  'Travel and Tourism': [
    { name: 'Tourism dynamics (EoC 1)', weight: 19 },
    { name: 'Destination management (EoC 2)', weight: 19 },
    { name: 'Hospitality in tourism (EoC 3)', weight: 19 },
    { name: 'Tourism events (EoC 4)', weight: 25 },
    { name: 'Tour operations (EoC 5)', weight: 18 },
  ],
  'Physical Education and Sport': [
    { name: 'Health related activities (EoC 1)', weight: 20 },
    { name: 'Motor activities (EoC 2)', weight: 20 },
    { name: 'Human body and movement (EoC 3)', weight: 20 },
    { name: 'Sports entrepreneurship (EoC 4)', weight: 20 },
    { name: 'Sports management (EoC 5)', weight: 20 },
  ],
  'Information and Communications Technology': [
    { name: 'ICT components and systems (EoC 1)', weight: 20 },
    { name: 'ICT tools and networks (EoC 2)', weight: 20 },
    { name: 'ICT analytical skills (EoC 3)', weight: 20 },
    { name: 'ICT systems evaluation (EoC 4)', weight: 20 },
    { name: 'ICT ethics (EoC 5)', weight: 20 },
  ],
};

async function main() {
  let school = await prisma.school.findFirst({ where: { name: { contains: 'Demo' } } });
  if (!school) {
    school = await prisma.school.findFirst();
  }
  if (!school) {
    console.log('No school found, creating default school...');
    school = await prisma.school.create({
      data: { name: 'Demo International School', subscriptionStatus: 'active', subscriptionTier: 'enterprise' },
    });
  }
  const schoolId = school.id;

  const existingSubjects = await prisma.subject.findMany({ where: { schoolId } });
  const existingCodes = new Map(existingSubjects.map(s => [s.code, s]));

  for (const sub of subjects) {
    let subjectId = existingCodes.get(sub.code)?.id;
    if (!subjectId) {
      const created = await prisma.subject.create({
        data: { name: sub.name, code: sub.code, schoolId },
      });
      subjectId = created.id;
      console.log(`Created subject: ${sub.name} (${sub.code})`);
    } else {
      console.log(`Subject already exists: ${sub.name} (${sub.code})`);
    }

    const subjectEocs = eocs[sub.name] || [];
    for (const eoc of subjectEocs) {
      const existing = await prisma.elementOfConstruct.findFirst({
        where: { name: eoc.name, subjectId },
      });
      if (!existing) {
        await prisma.elementOfConstruct.create({
          data: { name: eoc.name, construct: eoc.construct, subjectId, sortOrder: subjectEocs.indexOf(eoc) + 1, schoolId },
        });
        console.log(`  Created EoC: ${eoc.name}`);
      }
    }

    const subjectAos = assessmentObjectives[sub.name] || [];
    for (const ao of subjectAos) {
      const existing = await prisma.assessmentObjective.findFirst({
        where: { name: ao.name, subjectId },
      });
      if (!existing) {
        await prisma.assessmentObjective.create({
          data: { name: ao.name, weight: ao.weight, subjectId, schoolId },
        });
        console.log(`  Created AO: ${ao.name} (${ao.weight}%)`);
      }
    }
  }

  const doc = await prisma.syllabusDocument.findFirst({
    where: { title: 'ECZ Assessment Schemes 2026' },
  });
  if (!doc) {
    await prisma.syllabusDocument.create({
      data: {
        title: 'ECZ Assessment Schemes 2026',
        documentType: 'ASSESSMENT_SCHEME',
        curriculum: 'ECZ',
        filePath: 'uploads/library/ecseol_text.txt',
        fileType: 'text/plain',
        schoolId,
      },
    });
    console.log('Created SyllabusDocument: ECZ Assessment Schemes 2026');
  }

  console.log(`\nSeed complete! ${subjects.length} subjects, EoCs and AOs populated.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
