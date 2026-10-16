import {Ad,Article} from './data';
export type FeedItem={kind:'article';id:string;data:Article}|{kind:'ad';id:string;data:Ad};
/** Stable editorial rhythm: one house ad after every two stories, including on later pages. */
export function sequenceFeed(stories:Article[], adInventory:Ad[], pageSize=6):FeedItem[]{const result:FeedItem[]=[]; let ad=0; stories.forEach((story,index)=>{result.push({kind:'article',id:story.id,data:story}); if((index+1)%2===0&&adInventory.length){const item=adInventory[ad%adInventory.length];result.push({kind:'ad',id:item.id,data:item});ad++;}}); return result.slice(0,pageSize);}
