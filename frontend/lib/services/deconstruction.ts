import type { DeconstructionPayload, Round1, Round2, Round1Parsed, Round2Parsed } from '../types/deconstruction';
import { Round2Schema } from '../schemas/deconstruction';

export interface ParsedResult<T> {
    data: T | null;
    error: string | null;
    source?: 'json' | 'markdown';
}

export function parseRound1(text: string): ParsedResult<Round1> {
    if (!text.trim()) return { data: null, error: null };
    try {
        const json = JSON.parse(text);
        return { data: json as Round1, error: null, source: 'json' };
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
        const parsed = Round2Schema.parse(asJson);
        return { data: parsed as Round2, error: null, source: 'json' };
    } catch {
        // ignore, fallback to markdown
    }

    const mdParsed = parseRound2Markdown(text);
    if (mdParsed) return { data: mdParsed, error: null, source: 'markdown' };

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

function parseRound2Markdown(markdown: string): Round2 | null {
    const characters = extractCharacters(markdown);
    const shots = extractShots(markdown);
    if ((!characters || Object.keys(characters).length === 0) && (!shots || shots.length === 0)) {
        return null;
    }
    const result: Round2 = {};
    if (characters && Object.keys(characters).length > 0) result.characters = characters;
    if (shots && shots.length > 0) result.shots = shots;
    return result;
}

function extractCharacters(markdown: string): Record<string, string> | null {
    const codeBlockMatch = markdown.match(/```(?:text)?\s*([\s\S]*?)```/i);
    const section = codeBlockMatch ? codeBlockMatch[1] : markdown;
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
    const map: Record<string, string> = {};
    lines.forEach((line) => {
        const match = line.match(/【(.+?)】\s*[=:]\s*(.+)/);
        if (match) {
            const name = match[1].trim();
            const desc = match[2].trim();
            if (name) map[name] = desc;
        }
    });
    return Object.keys(map).length ? map : null;
}

function extractShots(markdown: string): Round2['shots'] | null {
    const lines = markdown.split('\n');
    const tableLines: string[] = [];
    let started = false;
    let lastIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!started) {
            if (trimmed.startsWith('|') && trimmed.includes('序号')) {
                started = true;
                tableLines.push(trimmed);
                lastIdx = tableLines.length - 1;
            }
        } else {
            if (trimmed.startsWith('|')) {
                tableLines.push(trimmed);
                lastIdx = tableLines.length - 1;
            } else if (trimmed.length && lastIdx >= 0) {
                // continuation of previous row (multi-line cell)
                tableLines[lastIdx] = `${tableLines[lastIdx]}<br>${trimmed}`;
            }
        }
    }
    if (tableLines.length < 3) return null;
    const header = splitRow(tableLines[0]);
    const dividerIdx = 1;
    const rows = tableLines.slice(dividerIdx + 1).map(splitRow).filter((r) => r.length > 0);

    const findIndex = (keywords: string[]) =>
        header.findIndex((h) => keywords.some((k) => h.includes(k)));
    const idxSeq = findIndex(['序号']);
    const idxStart = findIndex(['开始']);
    const idxEnd = findIndex(['结束']);
    const idxDuration = findIndex(['时长']);
    const idxKeyframe = findIndex(['首帧', 'frame']);
    const idxImagePrompt = findIndex(['画面', 'Image']);
    const idxVideoPrompt = findIndex(['视频', 'Video']);

    const shots: Round2['shots'] = [];
    rows.forEach((cols, rowIdx) => {
        const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : '');
        const idRaw = get(idxSeq);
        const id = idRaw ? parseInt(idRaw, 10) : rowIdx + 1;
        const shot = {
            id: Number.isNaN(id) ? rowIdx + 1 : id,
            timestamp: get(idxStart) || undefined,
            end_time: get(idxEnd) || undefined,
            duration: get(idxDuration) || undefined,
            keyframe: get(idxKeyframe) || undefined,
            initial_frame: normalizeCell(get(idxImagePrompt)),
            visual_changes: normalizeCell(get(idxVideoPrompt)),
        };
        shots.push(shot);
    });
    return shots;
}

function splitRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((cell) => cell.trim()).filter((cell) => cell.length > 0);
}

function normalizeCell(cell: string): string | undefined {
    if (!cell) return undefined;
    return cell.replace(/<br\s*\/?>/gi, '\n').trim();
}
