export type ReviewMode = 'review' | 'revision' | 'final';

export interface AssetItem {
    ordinal: number;
    start: number;
    end: number;
    duration: number;
    frame: string;
    frame_status: string;
    clip?: string | null;
    clip_status?: string | null;
}

export interface Round1Skeleton {
    logic_chain?: string;
    skeleton_nodes?: string[];
    viral_elements_found?: {
        category?: string;
        element?: string;
        timestamp?: string;
        description?: string;
    }[];
}

export interface Round1Hook {
    visual_hook?: string;
    audio_hook?: string;
    retention_strategy?: string;
    beat1_reference?: string;
}

export interface Round1Data {
    round1_skeleton?: Round1Skeleton;
    round1_hook?: Round1Hook;
}

export interface FrameCharacter {
    tag?: string;
    pose?: string;
    expression?: string;
    clothing?: string;
}

export interface FrameLayer {
    characters?: Array<FrameCharacter | string>;
    objects?: string[];
}

export interface StructuredInitialFrame {
    foreground?: FrameLayer;
    midground?: FrameLayer;
    background?: {
        environment?: string;
        depth?: string;
    };
    lighting?: string;
    color_palette?: string;
}

export interface ShotAlternative {
    type?: string;
    description?: string;
    visual_changes?: string;
    viral_score?: number;
    reason?: string;
    affected_shots_change?: number[];
}

export interface Round2Shot {
    id?: number;
    original_id?: number;
    modification_info?: {
        type?: string;
        reason?: string;
    };
    mission?: string;
    timestamp?: string;
    end_time?: string;
    duration?: string | number;
    keyframe?: string;
    initial_frame?: string | StructuredInitialFrame;
    visual_changes?: string;
    camera?: string;
    audio?: string;
    beat?: string;
    viral_element?: string;
    emotion?: string;
    logic_mapping?: string;
    modification?: {
        type?: string;
        reason?: string;
    };
    alternatives?: ShotAlternative[];
    density_score?: number;
}

export interface Round2Data {
    characters?: Record<string, string>;
    shots?: Round2Shot[];
}

export interface DeletedShot {
    original_id?: number;
    reason?: string;
    type?: string;
}

export interface OptimizedStoryboardPayload {
    round1?: Round1Data | string | null;
    round2?: Round2Data | string | null;
    metadata?: Record<string, unknown>;
    deconstruction?: {
        skeleton?: Round1Data | Record<string, unknown> | null;
        shots?: Round2Shot[];
        deleted_shots?: DeletedShot[];
        modified_assets?: {
            type?: string;
            original?: string;
            replacement?: string;
            reason?: string;
            affected_shots?: number[];
            element_type?: string;
        }[];
    };
    optimization_analysis?: {
        summary?: string;
        knowledge_base_applied?: string[];
        checkpoints?: Record<string, unknown>;
        modified_assets_overview?: Array<Record<string, unknown>>;
    };
}
