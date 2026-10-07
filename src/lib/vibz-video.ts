const formats: Record<string, { extension: string; mime: string }> = {
  mp4: { extension: 'mp4', mime: 'video/mp4' },
  mov: { extension: 'mov', mime: 'video/quicktime' },
  webm: { extension: 'webm', mime: 'video/webm' },
  m4v: { extension: 'm4v', mime: 'video/x-m4v' },
  '3gp': { extension: '3gp', mime: 'video/3gpp' },
  ogv: { extension: 'ogv', mime: 'video/ogg' },
}

export function vibzVideoFormat(file: { name: string; type: string }) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return formats[extension] ?? Object.values(formats).find(format => format.mime === file.type)
}