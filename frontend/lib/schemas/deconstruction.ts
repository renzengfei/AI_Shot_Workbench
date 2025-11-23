import { z } from 'zod';

export const ViralElementSchema = z
    .object({
        category: z.string().optional(),
        element: z.string().optional(),
        timestamp: z.string().optional(),
        description: z.string().optional(),
    })
    .partial()
    .passthrough();

export const Round1SkeletonSchema = z
    .object({
        story_summary: z.string().optional(),
        logic_chain: z.string().optional(),
        skeleton_nodes: z.array(z.string()).optional(),
        viral_elements_found: z.array(ViralElementSchema).optional(),
    })
    .partial()
    .passthrough();

export const Round1HookSchema = z
    .object({
        visual_hook: z.string().optional(),
        audio_hook: z.string().optional(),
        retention_strategy: z.string().optional(),
        beat1_reference: z.string().optional(),
    })
    .partial()
    .passthrough();

export const Round1Schema = z
    .object({
        round1_skeleton: Round1SkeletonSchema.optional(),
        round1_hook: Round1HookSchema.optional(),
    })
    .partial()
    .passthrough();

export const Round2ShotSchema = z
    .object({
        id: z.number().optional(),
        mission: z.string().optional(),
        timestamp: z.string().optional(),
        end_time: z.string().optional(),
        duration: z.union([z.string(), z.number()]).optional(),
        keyframe: z.string().optional(),
        initial_frame: z.string().optional(),
        visual_changes: z.string().optional(),
        camera: z.string().optional(),
        audio: z.string().optional(),
        beat: z.string().optional(),
        viral_element: z.string().optional(),
        emotion: z.string().optional(),
        logic_mapping: z.string().optional(),
    })
    .partial()
    .passthrough();

export const Round2Schema = z
    .object({
        characters: z.record(z.string()).optional(),
        shots: z.array(Round2ShotSchema).optional(),
    })
    .partial()
    .passthrough();

export const DeconstructionSchema = z
    .object({
        round1: Round1Schema.optional(),
        round2: Round2Schema.optional(),
    })
    .partial()
    .passthrough();
