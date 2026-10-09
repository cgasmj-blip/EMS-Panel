const imagePattern = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s<>"']*)?/gi
export function MessageImageLinks({ body }: { body: string }) {
  const urls = [...new Set(body.match(imagePattern) ?? [])].slice(0, 5)
  if (!urls.length) return null
  return <div className="mt-2 flex flex-wrap gap-2">{urls.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block max-w-full"><img src={url} alt="Image partagée" loading="lazy" referrerPolicy="no-referrer" className="max-h-64 max-w-full rounded-lg object-contain" /></a>)}</div>
}
