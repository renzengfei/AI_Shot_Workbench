import { z } from 'zod';
import { Round1Schema, Round2Schema, DeconstructionSchema } from '../schemas/deconstruction';

export type Round1 = z.infer<typeof Round1Schema>;
export type Round2 = z.infer<typeof Round2Schema>;
export type DeconstructionPayload = z.infer<typeof DeconstructionSchema>;

export type Round1Parsed = Round1 | string | null;
export type Round2Parsed = Round2 | string | null;
