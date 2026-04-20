// parser for mse (magic set editor) set files.
// it's basically yaml-lite: indented key: value, repeated keys allowed,
// empty-value keys open either a nested block or a multi-line string.
//
// example:
//     mse_version: 2.0.0
//     game: magic
//     card:
//         name: lightning bolt
//         rule text:
//             deal 3 damage to
//             any target.
//     card:
//         name: counterspell
//
// we keep [key, value] tuples instead of plain objects because `card`
// shows up a zillion times at the top level and we'd lose all but one.

export type MseValue = string | MseNode[];
export type MseNode = [string, MseValue];

// count leading spaces/tabs
function getIndent(line: string): number {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  return i;
}

export function parseMse(text: string): MseNode[] {
  const lines = text.split(/\r?\n/);
  const root: MseNode[] = [];

  // stack of open containers. root gets indent -1 so any real line
  // (indent >= 0) sits inside it.
  const stack: Array<[number, MseNode[]]> = [[-1, root]];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // skip blanks
    if (line.trim() === '') { i++; continue; }

    const indent = getIndent(line);

    // pop anything that can't own a line this shallow
    while (stack.length > 0 && indent <= stack[stack.length - 1][0]) {
      stack.pop();
    }

    // shape is "<indent><key>: <maybe value>". keys can't contain ':'.
    const m = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!m) { i++; continue; }

    const key = m[2].trim();
    const value = m[3];

    if (value === '') {
      // no inline value. peek ahead to figure out if this is a nested
      // block or a multi-line string.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;

      if (j < lines.length) {
        const childIndent = getIndent(lines[j]);

        if (childIndent > indent) {
          if (/^\s*[\w]+:/.test(lines[j])) {
            // looks like "word:" -> nested block. push and keep going,
            // the outer loop will parse the children.
            const child: MseNode[] = [];
            stack[stack.length - 1][1].push([key, child]);
            stack.push([indent, child]);
            i++;
            continue;
          } else {
            // raw text block. eat every following line that's blank or
            // indented past the parent, and strip off childIndent so the
            // first line starts at column 0.
            const buf: string[] = [];
            while (j < lines.length) {
              if (lines[j].trim() === '') { buf.push(''); j++; continue; }
              const ci = getIndent(lines[j]);
              if (ci <= indent) break;
              buf.push(lines[j].slice(childIndent));
              j++;
            }
            // rstrip() equivalent so trailing blank lines don't leak in
            stack[stack.length - 1][1].push([key, buf.join('\n').replace(/\s+$/, '')]);
            i = j;
            continue;
          }
        }
      }

      // nothing indented follows -> just an empty string value
      stack[stack.length - 1][1].push([key, '']);
    } else {
      stack[stack.length - 1][1].push([key, value]);
    }

    i++;
  }

  return root;
}

// like MseValue but after we've collapsed everything into plain objects
// -- strings at the leaves, nested dicts for nested blocks.
// (CardDict has to be an interface so the alias can be recursive.)
export type CardValue = string | CardDict;
export interface CardDict { [key: string]: CardValue }

// recursively turn a parsed [key, value][] into a plain object.
// duplicate keys at any level collapse to the last one (python-style
// dict(v)). if that matters for a given field, use parseMse directly.
function toDict(nodes: MseNode[]): CardDict {
  const obj: CardDict = {};
  for (const [k, v] of nodes) {
    obj[k] = Array.isArray(v) ? toDict(v) : v;
  }
  return obj;
}

// grab the top-level `card` entries as plain (recursively-dict'd) objects.
// heads up: duplicate keys collapse at every level (see toDict). drop
// down to parseMse if you need to preserve them.
export function cards(parsed: MseNode[]): CardDict[] {
  const result: CardDict[] = [];
  for (const [k, v] of parsed) {
    if (k === 'card' && Array.isArray(v)) {
      result.push(toDict(v));
    }
  }
  return result;
}
