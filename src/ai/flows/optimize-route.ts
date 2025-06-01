'use server';

/**
 * @fileOverview Optimizes routes and load configurations using AI, considering historical data and real-time conditions.
 *
 * - optimizeRoute - A function that suggests optimized routes and load configurations.
 * - OptimizeRouteInput - The input type for the optimizeRoute function.
 * - OptimizeRouteOutput - The return type for the optimizeRoute function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OptimizeRouteInputSchema = z.object({
  historicalData: z
    .string()
    .describe('Historical route and load data in JSON format.'),
  realTimeConditions: z
    .string()
    .describe('Real-time traffic, weather, and other relevant conditions in JSON format.'),
  deliveryConstraints: z
    .string()
    .describe('Delivery constraints such as time windows and location requirements in JSON format.'),
});
export type OptimizeRouteInput = z.infer<typeof OptimizeRouteInputSchema>;

const OptimizedRouteSuggestionSchema = z.object({
  route: z.array(z.string()).describe('An array of location IDs representing the optimized route.'),
  loadConfiguration: z
    .record(z.number())
    .describe('A map of product IDs to quantities representing the optimized load configuration.'),
  estimatedDeliveryTime: z
    .string()
    .describe('Estimated delivery time based on the optimized route and load.'),
  estimatedFuelCost: z.number().describe('Estimated fuel cost for the optimized route.'),
});

const OptimizeRouteOutputSchema = z.object({
  suggestions: z.array(OptimizedRouteSuggestionSchema).describe('An array of optimized route and load suggestions.'),
});

export type OptimizeRouteOutput = z.infer<typeof OptimizeRouteOutputSchema>;

export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteOutput> {
  return optimizeRouteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeRoutePrompt',
  input: {schema: OptimizeRouteInputSchema},
  output: {schema: OptimizeRouteOutputSchema},
  prompt: `You are a route optimization expert. Given the historical data, real-time conditions, and delivery constraints, suggest optimized routes and load configurations to minimize delivery times and fuel costs.\n\nHistorical Data: {{{historicalData}}}\nReal-time Conditions: {{{realTimeConditions}}}\nDelivery Constraints: {{{deliveryConstraints}}}\n\nProvide multiple route suggestions, considering different factors like minimizing distance, avoiding traffic, and balancing load across vehicles.\n\nEnsure that the output is a JSON array of route suggestions, each containing the route (as an array of location IDs), the load configuration (as a map of product IDs to quantities), the estimated delivery time, and the estimated fuel cost.\n`,
});

const optimizeRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRouteFlow',
    inputSchema: OptimizeRouteInputSchema,
    outputSchema: OptimizeRouteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
