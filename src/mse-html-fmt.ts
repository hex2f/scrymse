// helpers for turning mse's inline html-ish markup into plain text with
// {...} style tokens. mse stores card text as a little xml fragment,
// e.g. "<sym-auto>12WU/B</sym-auto>, <i>tap</i>: do the thing", and we
// want something closer to "{12}{W}{U/B}, {i}tap{/i}: do the thing".

import * as htmlparser2 from 'htmlparser2';
import type { CardValue } from './mse-reader';

// chop a mana string into its component symbols.
// rules:
//   - '/' glues onto the previous symbol (hybrid mana: w/u, 2/w, ...)
//   - consecutive digits stay together so "10" is one symbol, not two
//   - everything else is its own symbol
// e.g. "12WU/B" -> ["12", "W", "U/B"]. caller decides how to wrap/join.
export function parseMana(raw: string | CardValue): string[] {
    if (typeof raw !== 'string') {
        return []
    }
    const parts: string[] = []
    for (const c of raw) {
        if (parts.length > 0) {
            if (c === "/") {
                // hybrid separator, stick it on the previous symbol
                parts[parts.length - 1] += c;
            } else if (Number.isInteger(Number(c)) && Number.isInteger(Number(parts[parts.length - 1].at(-1)))) {
                // digit following a digit -> same number
                parts[parts.length - 1] += c;
            } else {
                parts.push(c);
            }
        } else {
            parts.push(c);
        }
    }

    return parts;
}

// walk the html-ish card text and emit our {}-tokenized version.
// only the tags we actually care about get rewritten; everything else
// falls through and its text content is copied verbatim.
export function fmt(raw: string | CardValue): string {
    let result = '';
    if (typeof raw !== 'string') {
        return JSON.stringify(raw);
    }
    // counter for pending sym-auto text nodes. bumped on every
    // <sym-auto> open, and decremented either when we consume the text
    // inside it or when the tag closes empty. using a counter instead of
    // a bool so nested/back-to-back sym-auto tags don't clobber state.
    let explodeWhatComesNext = 0;
    const parser = new htmlparser2.Parser({
        onopentag: (name, _attribs) => {
            switch (name) {
                case 'sym-auto':
                    // mana block: "<sym-auto>12WU/B</sym-auto>" -> "{12}{W}{U/B}"
                    // open brace here, close brace on the matching close
                    // tag, and the text handler fills in the middle with
                    // parseMana(text).join('}{')
                    result += '{'
                    explodeWhatComesNext += 1;
                    break;
                case 'i':
                    // italics become literal {i}...{/i} tokens so
                    // downstream renderers can decide what to do
                    result += '{i}'
                    break;
                default:
                    break;
            }
        },
        onclosetag: (name) => {
            switch (name) {
                case 'sym-auto':
                    result += '}'
                    explodeWhatComesNext -= 1;
                    break;
                case 'i':
                    result += '{/i}'
                    break;
                default:
                    break;
            }
        },
        ontext: (text) => {
            if (explodeWhatComesNext > 0) {
                // inside a sym-auto: split into mana symbols and glue
                // them with '}{' so they slot between the braces from
                // the open/close tag handlers.
                result += parseMana(text).join('}{');
                explodeWhatComesNext -= 1;
            } else {
                // normal text outside any tag we care about, pass through
                result += text;
            }
        }
    })
    parser.write(raw);
    parser.end();
    return result;
}
