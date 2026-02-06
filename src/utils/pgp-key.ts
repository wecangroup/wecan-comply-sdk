/**
 * Normalize PGP private key armor so OpenPGP can parse it.
 * - Extracts the block between -----BEGIN PGP PRIVATE KEY BLOCK----- and -----END ...
 * - Ensures a mandatory blank line between armor headers and base64 data (required by OpenPGP)
 */
const BASE64_ARMOR_LINE = /^[A-Za-z0-9+/]+=*$/;

export function normalizePgpPrivateKey(raw: string): string {
    const begin = '-----BEGIN PGP PRIVATE KEY BLOCK-----';
    const end = '-----END PGP PRIVATE KEY BLOCK-----';
    const startIdx = raw.indexOf(begin);
    const endIdx = raw.indexOf(end);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        return raw.trim();
    }
    let block = raw.slice(startIdx, endIdx + end.length);
    const lines = block.split(/\r?\n/);
    let dataStart = -1;
    for (let i = 1; i < lines.length; i++) {
        if (BASE64_ARMOR_LINE.test(lines[i])) {
            dataStart = i;
            break;
        }
    }
    if (dataStart > 0 && dataStart < lines.length && lines[dataStart - 1].trim() !== '') {
        lines.splice(dataStart, 0, '');
        block = lines.join('\n');
    }
    return block.trim();
}
