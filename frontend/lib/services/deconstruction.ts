import type { DeconstructionPayload, Round1, Round2, Round1Parsed, Round2Parsed } from '../types/deconstruction';

export interface ParsedResult<T> {
    data: T | null;
    error: string | null;
}

export function parseRound1(text: string): ParsedResult<Round1> {
    if (!text.trim()) return { data: null, error: null };
    try {
        const json = JSON.parse(text);
        return { data: json as Round1, error: null };
    } catch {
        return { data: null, error: 'Round 1 JSON 解析失败，请检查是否为合法 JSON' };
    }
}

export function parseRound2(text: string): ParsedResult<Round2> {
    const trimmed = text.trim();
    if (!trimmed) return { data: null, error: null };

    // 尝试 JSON 模式
    try {
        const asJson = JSON.parse(trimmed);
        if (asJson && typeof asJson === 'object' && (asJson.shots || asJson.characters)) {
            return { data: asJson as Round2, error: null };
        }
    } catch {
        return { data: null, error: 'Round 2 解析失败，请粘贴合法 JSON（含 shots 或 characters）' };
    }

    return { data: null, error: 'Round 2 解析失败，请粘贴合法 JSON（含 shots 或 characters）' };
}


export function parseStoredDeconstruction(raw: string): {
    round1: Round1Parsed;
    round2: Round2Parsed;
    rawRound1Text: string | null;
    rawRound2Text: string | null;
    errorsRound1: string[];
    errorsRound2: string[];
    errorsGeneral: string[];
} {
    if (!raw) return { round1: null, round2: null, rawRound1Text: null, rawRound2Text: null, errorsRound1: [], errorsRound2: [], errorsGeneral: [] };
    const errorsRound1: string[] = [];
    const errorsRound2: string[] = [];
    const errorsGeneral: string[] = [];

    const tryParse = <T>(value: unknown): T | null => {
        if (typeof value !== 'string') return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    };
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
            const obj = parsed as Record<string, unknown>;
            const rawRound1Text = typeof obj.round1_raw === 'string'
                ? obj.round1_raw
                : typeof obj.round1 === 'string'
                    ? obj.round1
                    : null;
            const rawRound2Text = typeof obj.round2_raw === 'string'
                ? obj.round2_raw
                : typeof obj.round2 === 'string'
                    ? obj.round2
                    : null;

            let round1Candidate: Round1Parsed = null;
            if (obj.round1 !== undefined) {
                round1Candidate = typeof obj.round1 === 'string' ? tryParse<Round1>(obj.round1) ?? obj.round1 : (obj.round1 as Round1);
            } else if (obj.round1_skeleton || obj.round1_hook) {
                round1Candidate = {
                    round1_skeleton: obj.round1_skeleton as Round1['round1_skeleton'],
                    round1_hook: obj.round1_hook as Round1['round1_hook'],
                };
            }

            let round2Candidate: Round2Parsed = null;
            if (obj.round2 !== undefined) {
                if (typeof obj.round2 === 'string') {
                    const parsedMd = parseRound2(obj.round2).data;
                    round2Candidate = parsedMd ?? obj.round2;
                    if (!parsedMd) errorsRound2.push('Round 2 解析失败，已按原文显示');
                } else {
                    round2Candidate = obj.round2 as Round2;
                }
            } else if (obj.shots || obj.characters) {
                round2Candidate = {
                    characters: obj.characters as Round2['characters'],
                    shots: obj.shots as Round2['shots'],
                };
            } else if (typeof obj.round2_raw === 'string') {
                const parsedMd = parseRound2(obj.round2_raw).data;
                round2Candidate = parsedMd ?? obj.round2_raw;
                if (!parsedMd) errorsRound2.push('Round 2 解析失败，已按原文显示');
            }

            const round1: Round1Parsed = round1Candidate ?? null;
            const round2: Round2Parsed = round2Candidate ?? null;

            return { round1, round2, rawRound1Text, rawRound2Text, errorsRound1, errorsRound2, errorsGeneral };
        }
    } catch {
        errorsGeneral.push('内容不是合法 JSON，已按原文显示');
    }
    return { round1: raw, round2: null, rawRound1Text: raw, rawRound2Text: null, errorsRound1, errorsRound2, errorsGeneral };
}

export function buildDeconstructionPayload(round1: Round1 | null, round2: Round2 | null): string {
    const payload: DeconstructionPayload = {};
    if (round1) payload.round1 = round1;
    if (round2) payload.round2 = round2;
    return JSON.stringify(payload, null, 2);
}
