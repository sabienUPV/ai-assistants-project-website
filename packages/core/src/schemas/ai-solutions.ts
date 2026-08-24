import { z } from 'astro/zod';

/*
Template schema for AI Solutions:

Name: [Name of the AI Solution/product]
Company/ Responsible Entity / Creator: [Name of the company/provider/creator of the AI solution]  

Link/URL: [Link to the solution, where to access it] 

Brief Description: [Description of the AI solution: e.g.  what is it, what does it to, what is its scope, what is it developed for etc. to get an understanding what its functions are]

Thematic area: [For which area of independent living is the solution suitable: Entertainment, Communication, Mobility, Home Autonomy, Social Participation, Employment, Healthcare & Wellbeing. It can be more than one]
How can it be used for independent living for PID: [Specific description and examples how the AI solution can support PID in the chosen area(s) of independent living. In what ways can the AI support PIDs, how can the target audience make effective use of it etc.?] 
Potential barriers: [Are there potential barriers for PIDs, does it need some preparations to be suitable or other things to look out for etc?] 
Keywords: [Some keywords about the AI solution about the content, topic, etc.] 

Type of AI solution: [Types could be for example chatbot, image generator, voice assistant etc. in accordance with its description. Only short descriptors as a classification] 

Available as: [e.g. Website, Mobile App (Android/IOS), PC Software (Win/Mac/Linux)]

Country of Origin: [Where is the company/creator located]

Available Language(s): [Which languages does it support]  

Accessibility option: [Are there any specific accessibility options, e.g. simple language, voice interaction, audio descriptors etc.]

Registration Required: [yes or no?]

Costs/Monetization: [Is the AI solution free, paid, available as a freemium model (free with additional purchase options), does it offer a free basic account and paid premium accounts, a subscription, or one-time purchases?]
*/

export const aiSolutionSchema = z.object({
  id: z.string(), // ID field required by the Astro Content Collections file() loader. It is the first column of the CSV file.
  name: z.string(),
  company: z.string(),
  link: z.url(),
  description: z.string(),
  thematicArea: z.string().transform((str) => str.split(',').map(s => s.trim())),
  usageForIndependentLiving: z.string(),
  potentialBarriers: z.string().optional(),
  keywords: z.string().transform((str) => str.split(',').map(s => s.trim())),
  type: z.string(),
  availableAs: z.string(),
  countryOfOrigin: z.string(),
  availableLanguages: z.string().transform((str) => str.split(',').map(s => s.trim())),
  accessibilityOptions: z.string().optional(),
  registrationRequired: z.string().transform((str) => str.toLowerCase().trim() === 'yes'),
  costsMonetization: z.string(),
});

export type AiSolution = z.infer<typeof aiSolutionSchema>;