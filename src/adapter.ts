import {articles, ads, Article, Ad} from './data';
export interface ContentAdapter { listArticles(query?:string, category?:string):Promise<Article[]>; getArticle(id:string):Promise<Article|undefined>; listAds(query?:string):Promise<Ad[]>; }
export class DemoContentAdapter implements ContentAdapter { async listArticles(query='', category=''){return articles.filter(a=>(!query||`${a.title} ${a.excerpt}`.toLowerCase().includes(query.toLowerCase()))&&(!category||a.category===category));} async getArticle(id:string){return articles.find(a=>a.id===id)} async listAds(query=''){return ads.filter(a=>!query||`${a.business} ${a.title} ${a.category}`.toLowerCase().includes(query.toLowerCase()));} }
// Production seam: implement these methods with Appwrite Databases.listDocuments/getDocument.
export class AppwriteContentAdapter extends DemoContentAdapter { constructor(public endpoint=import.meta.env.VITE_APPWRITE_ENDPOINT, public projectId=import.meta.env.VITE_APPWRITE_PROJECT_ID){super();} }
export const contentAdapter:ContentAdapter = import.meta.env.VITE_CONTENT_MODE==='appwrite' ? new AppwriteContentAdapter() : new DemoContentAdapter();
