import {z} from 'zod';
export const checkoutSchema=z.object({
 idempotencyKey:z.string().uuid(),
 customer:z.object({name:z.string().trim().min(2).max(80),email:z.email().max(150),phone:z.string().trim().regex(/^[+\d ()-]{7,25}$/),address:z.string().trim().min(5).max(250),city:z.string().trim().min(2).max(80),postcode:z.string().regex(/^\d{5}$/),state:z.enum(['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Sabah','Sarawak','Labuan']),country:z.literal('MY')}),
 items:z.array(z.object({id:z.string().min(1).max(80),option:z.string().min(1).max(80),qty:z.number().int().min(1).max(20)})).min(1).max(25),
 paymentScenario:z.enum(['approve','decline'])
}).strict();
export type CheckoutInput=z.infer<typeof checkoutSchema>;
export type OrderStatus='test_received'|'test_processing'|'test_shipped'|'test_delivered'|'test_cancelled';
export const transitions:Record<OrderStatus,OrderStatus[]>={test_received:['test_processing','test_cancelled'],test_processing:['test_shipped','test_cancelled'],test_shipped:['test_delivered'],test_delivered:[],test_cancelled:[]};
export function deliveryCents(state:string){return ['Sabah','Sarawak','Labuan'].includes(state)?1500:800}
export class CommerceError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status}}
