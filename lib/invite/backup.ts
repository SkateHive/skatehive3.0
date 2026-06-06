export interface InviteKeys {
  owner?: string;
  active?: string;
  posting?: string;
  memo?: string;
  ownerPubkey?: string;
  activePubkey?: string;
  postingPubkey?: string;
  memoPubkey?: string;
}

export function buildInviteKeysBackup(args: {
  createdby: string;
  desiredUsername: string;
  masterPassword: string;
  keys: InviteKeys;
  createdAt?: string;
}): string {
  const { createdby, desiredUsername, masterPassword, keys } = args;
  const createdAt = args.createdAt ?? new Date().toISOString();

  return [
    '================================================',
    '         SKATEHIVE ACCOUNT KEYS BACKUP',
    '================================================',
    '',
    `Username:        ${desiredUsername}`,
    `Master Password: ${masterPassword}`,
    '',
    `Invited by:      @${createdby}`,
    `Created:         ${createdAt}`,
    '',
    '------------------------------------------------',
    '              PRIVATE KEYS',
    '------------------------------------------------',
    `Owner:    ${keys?.owner ?? '(missing)'}`,
    `Active:   ${keys?.active ?? '(missing)'}`,
    `Posting:  ${keys?.posting ?? '(missing)'}`,
    `Memo:     ${keys?.memo ?? '(missing)'}`,
    '',
    '------------------------------------------------',
    '              PUBLIC KEYS',
    '------------------------------------------------',
    `Owner:    ${keys?.ownerPubkey ?? '(missing)'}`,
    `Active:   ${keys?.activePubkey ?? '(missing)'}`,
    `Posting:  ${keys?.postingPubkey ?? '(missing)'}`,
    `Memo:     ${keys?.memoPubkey ?? '(missing)'}`,
    '',
    '================================================',
    '                  KEEP SAFE',
    '================================================',
    '  - DO NOT share these keys with anyone.',
    '  - DO NOT lose this file.',
    '  - The Master Password can regenerate all keys.',
    '  - Store this file in a password manager or',
    '    encrypted offline backup.',
    '================================================',
    '',
  ].join('\n');
}
