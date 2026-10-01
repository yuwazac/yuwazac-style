export type Product={id:string;name:string;category:'Phone'|'Fashion';priceCents:number;image:string;images?:string[];processingEstimate?:string;deliveryEstimate?:string;options:string[];stock:number;description:string;supplier:string};
export type CartItem={id:string;option:string;qty:number};
export const seedProducts:Product[]=[
{id:'case',name:'Everyday clear case',category:'Phone',priceCents:2900,image:'phone',options:['iPhone 15','iPhone 15 Pro','iPhone 14'],stock:30,description:'Sample case concept. The phone image is illustrative; phone not included. Compatibility and materials require supplier confirmation.',supplier:'demo'},
{id:'audio',name:'Over-ear headphones',category:'Phone',priceCents:12900,image:'headphones',options:['Black'],stock:12,description:'A sample audio accessory for your everyday soundtrack. Connection type and specifications are not yet verified.',supplier:'demo'},
{id:'backpack',name:'The everyday backpack',category:'Fashion',priceCents:8900,image:'bag',options:['Navy'],stock:15,description:'A pared-back companion for daily essentials. Sample item; dimensions and materials require supplier confirmation.',supplier:'demo'},
{id:'watch',name:'The minimal watch',category:'Fashion',priceCents:14900,image:'watch',options:['Light strap'],stock:9,description:'A simple everyday accessory. Sample item; strap, movement and dimensions require supplier confirmation.',supplier:'demo'},
{id:'sunglasses',name:'Round-frame sunglasses',category:'Fashion',priceCents:4900,image:'sunglasses',options:['Gold frame'],stock:18,description:'A round silhouette for your accessory rotation. Sample only; lens specifications and UV protection have not been verified.',supplier:'demo'},
{id:'cap',name:'The essential cap',category:'Fashion',priceCents:3900,image:'cap',options:['White'],stock:20,description:'A simple finishing touch for laid-back days. Sample cap; sizing and material details require supplier confirmation.',supplier:'demo'}
];
export const money=(cents:number)=>new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(cents/100);

export const productImage=(p:Product)=>p.images?.[0]||'/assets/'+p.image+'.jpg';
