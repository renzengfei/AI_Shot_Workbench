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
        initial_frame: z
            .union([
                z.string(),
                z.object({
                    foreground: z.any().optional(),
                    midground: z.any().optional(),
                    background: z.any().optional(),
                    lighting: z.any().optional(),
                    color_palette: z.any().optional(),
                }).passthrough(),
            ])
            .optional(),
        visual_changes: z.string().optional(),
        camera: z.string().optional(),
        audio: z.string().optional(),
        beat: z.string().optional(),
        viral_element: z.string().optional(),
        emotion: z.string().optional(),
        logic_mapping: z.string().optional(),
        discarded: z.boolean().optional(),
        merge_with_previous: z.boolean().optional(),
    })
    .partial()
    .passthrough();

export const Round2Schema = z
    .object({
        // v4 record 需要显式指定键和值类型
        characters: z.record(z.string(), z.string()).optional(),
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
