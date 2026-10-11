export const PERSONAS = [
  { id: 'balanced', label: 'Balanced', description: 'Natural, everyday conversation.', icon: 'chat' },
  { id: 'chill', label: 'Chill friend', description: 'Relaxed, easygoing, and low pressure.', icon: 'sun' },
  { id: 'coach', label: 'Patient coach', description: 'Encouraging questions, one step at a time.', icon: 'target' },
  { id: 'professional', label: 'Professional', description: 'Polished workplace conversation.', icon: 'briefcase' },
  { id: 'challenger', label: 'Thoughtful challenger', description: 'Deeper questions and friendly debate.', icon: 'chart' },
];

export function validPersona(value) {
  return PERSONAS.some(persona => persona.id === value) ? value : 'balanced';
}
