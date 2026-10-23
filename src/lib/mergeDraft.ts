export type DraftObject = Record<string, unknown>
const equal = (a:unknown,b:unknown) => JSON.stringify(a)===JSON.stringify(b)
const object = (v:unknown):v is DraftObject => !!v && typeof v==='object' && !Array.isArray(v)
/** Three-way merge: disjoint fields combine; competing edits remain explicit. */
export function mergeDraft(base:DraftObject,local:DraftObject,remote:DraftObject){
 const conflicts:string[]=[]
 function merge(b:unknown,l:unknown,r:unknown,path:string):unknown {
  if(equal(l,b))return r
  if(equal(r,b)||equal(l,r))return l
  if(object(l)&&object(r)&&(object(b)||b===undefined)){
   const out:DraftObject={};const original=object(b)?b:{}
   for(const key of new Set([...Object.keys(original),...Object.keys(l),...Object.keys(r)])){
    if(['__proto__','constructor','prototype'].includes(key))continue
    const value=merge(original[key],l[key],r[key],path?path+'.'+key:key)
    if(value!==undefined)out[key]=value
   }
   return out
  }
  conflicts.push(path);return l
 }
 return {payload:merge(base,local,remote,'') as DraftObject,conflicts}
}
