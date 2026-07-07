import { BaseSubjectEngine, EngineResponse } from './base-engine';

const PHYSICS_FORMULAS: Record<string, string> = {
  'newton': 'F = ma (Force = mass × acceleration)',
  'ohms': 'V = IR (Voltage = Current × Resistance)',
  'kinetic': 'KE = ½mv² (Kinetic Energy)',
  'potential': 'PE = mgh (Potential Energy)',
  'speed': 'v = d/t (Speed = Distance / Time)',
  'acceleration': 'a = (v-u)/t (Acceleration)',
  'density': 'ρ = m/V (Density = Mass / Volume)',
  'pressure': 'P = F/A (Pressure = Force / Area)',
  'work': 'W = Fd (Work = Force × Distance)',
  'power': 'P = W/t (Power = Work / Time)',
  'frequency': 'f = 1/T (Frequency = 1 / Period)',
  'wavelength': 'v = fλ (Wave Speed = Frequency × Wavelength)',
  'refractive': 'n = sin i / sin r (Snell\'s Law)',
  'boyles': 'P₁V₁ = P₂V₂ (Boyle\'s Law)',
  'charles': 'V₁/T₁ = V₂/T₂ (Charles\' Law)',
  'momentum': 'p = mv (Momentum = mass × velocity)',
};

const CHEMISTRY_FORMULAS: Record<string, string> = {
  'mole': 'n = m/M (Moles = Mass / Molar Mass)',
  'concentration': 'C = n/V (Concentration = Moles / Volume)',
  'ideal gas': 'PV = nRT (Ideal Gas Equation)',
  'ph': 'pH = -log[H⁺] (pH Calculation)',
};

interface StructuredScienceResult {
  type: 'science_explanation' | 'physics' | 'chemistry' | 'biology' | 'general';
  explanation: string;
  rendered_math?: Array<{ latex: string; display: 'block' | 'inline' }>;
  steps?: Array<{
    number: number;
    title: string;
    content: string;
    math?: Array<{ latex: string; display: 'block' | 'inline' }>;
  }>;
  tables?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
  diagrams?: Array<{
    type: string;
    params: Record<string, any>;
  }>;
  answer?: {
    latex: string;
    text: string;
  };
  practice_question?: {
    question: string;
    math?: Array<{ latex: string; display: 'block' | 'inline' }>;
    difficulty: string;
  };
  common_mistakes?: string[];
  interactive?: {
    whyThisMethod?: string;
    alternativeMethod?: string;
  };
}

export class ScienceEngine extends BaseSubjectEngine {
  constructor() {
    super('science', [
      'physics', 'chemistry', 'biology', 'science',
      'physique', 'chimie', 'biologie',
    ]);
  }

  async postprocessResponse(response: string, query: string): Promise<EngineResponse> {
    const topic = this.detectTopic(query);
    const formulas = this.getRelevantFormulas(query);
    const practiceQuestions = await this.generatePracticeQuestions(query);

    let finalContent = response;
    try {
      const parsed = JSON.parse(response) as StructuredScienceResult;
      if (parsed && typeof parsed === 'object' && parsed.type) {
        finalContent = JSON.stringify(parsed);
      }
    } catch {}

    return {
      content: finalContent,
      subject: 'Science',
      topic,
      suggestions: this.getStudySuggestions(topic),
      practiceQuestions: practiceQuestions.slice(0, 2),
    };
  }

  async generatePracticeQuestion(topic: string, difficulty: number = 1): Promise<string> {
    const questions: Record<string, string[]> = {
      physics: [
        'A car accelerates from rest at 2 m/s² for 5 seconds. Calculate its final velocity and distance traveled.',
        'A 2kg object is dropped from a height of 10m. Calculate its potential energy at the top and kinetic energy just before hitting the ground.',
        'A circuit has a 12V battery connected to a 4Ω resistor. Calculate the current flowing through the circuit.',
      ],
      chemistry: [
        'Balance the equation: H₂ + O₂ → H₂O',
        'Calculate the number of moles in 36g of water (H₂O, Mr = 18)',
        'What is the pH of a 0.01M HCl solution?',
      ],
      biology: [
        'Explain the process of photosynthesis. Include the reactants, products, and where each stage occurs.',
        'Describe how the nervous system transmits information from a stimulus to a response.',
        'What are the differences between mitosis and meiosis?',
      ],
    };

    for (const [key, qs] of Object.entries(questions)) {
      if (topic.toLowerCase().includes(key) || key.includes(topic.toLowerCase())) {
        return qs[difficulty % qs.length];
      }
    }
    return questions.physics[0];
  }

  private detectTopic(query: string): string | undefined {
    const lower = query.toLowerCase();
    if (lower.includes('physics') || lower.includes('force') || lower.includes('energy') || lower.includes('wave') || lower.includes('circuit') || lower.includes('motion')) return 'Physics';
    if (lower.includes('chemistry') || lower.includes('element') || lower.includes('reaction') || lower.includes('atom') || lower.includes('acid') || lower.includes('bond')) return 'Chemistry';
    if (lower.includes('biology') || lower.includes('cell') || lower.includes('dna') || lower.includes('genetic') || lower.includes('photosynthesis') || lower.includes('ecosystem') || lower.includes('evolution')) return 'Biology';
    return undefined;
  }

  private getRelevantFormulas(query: string): string[] {
    const lower = query.toLowerCase();
    const formulas: string[] = [];

    for (const [key, formula] of Object.entries(PHYSICS_FORMULAS)) {
      if (lower.includes(key)) formulas.push(formula);
    }
    for (const [key, formula] of Object.entries(CHEMISTRY_FORMULAS)) {
      if (lower.includes(key)) formulas.push(formula);
    }
    return formulas;
  }

  private async generatePracticeQuestions(query: string): Promise<string[]> {
    const lower = query.toLowerCase();
    const questions: string[] = [];

    if (lower.includes('physics') || lower.includes('force') || lower.includes('motion')) {
      questions.push('A ball is thrown vertically upward with an initial velocity of 20 m/s. Calculate the maximum height reached. (g = 10 m/s²)');
      questions.push('A 60W light bulb operates for 5 hours. Calculate the energy consumed in kWh.');
    }
    if (lower.includes('chemistry') || lower.includes('reaction') || lower.includes('mole')) {
      questions.push('Calculate the mass of sodium chloride (NaCl) produced when 10g of sodium reacts completely with chlorine. (Na = 23, Cl = 35.5)');
    }
    if (lower.includes('biology') || lower.includes('cell') || lower.includes('genetic')) {
      questions.push('In pea plants, tall stem (T) is dominant over short stem (t). If two heterozygous tall plants are crossed, what are the possible genotypes and phenotypes of the offspring?');
    }

    return questions;
  }

  private getStudySuggestions(topic?: string): string[] {
    if (topic === 'Physics') return ['Practice formula manipulation', 'Draw free-body diagrams for mechanics problems'];
    if (topic === 'Chemistry') return ['Memorize periodic table trends', 'Practice balancing chemical equations'];
    if (topic === 'Biology') return ['Create mind maps for biological processes', 'Practice labeling diagrams'];
    return ['Review scientific method and experiment design'];
  }
}
