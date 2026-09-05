const bcrypt = require('bcrypt');
const { pool } = require('../../config/db');
const { env } = require('../../config/env');

const ORG = '00000000-0000-4000-8000-000000000001';
const uid = (group, n) => `00000000-0000-4${String(group).padStart(3, '0')}-8000-${String(n).padStart(12, '0')}`;
const emailDomain = 'demo.urbanfurniture.local';
const plannedCounts = {
	organizations: 1, users: 5, otp_verifications: 1, refresh_tokens: 1,
	accounts: 10, contacts: 23, product_categories: 5, taxes: 3, products: 30,
	journals: 4, analytic_accounts: 5, budgets: 3, document_sequences: 6,
	journal_entries: 12, journal_entry_lines: 24, purchase_orders: 4,
	purchase_order_lines: 8, vendor_bills: 4, vendor_bill_lines: 8,
	sales_orders: 5, sales_order_lines: 10, customer_invoices: 5,
	customer_invoice_lines: 10, payments: 5, payment_allocations: 5,
	attachments: 2, audit_logs: 12, notifications: 5,
};
const insertionOrder = Object.keys(plannedCounts);
const money = (value) => Number(value).toFixed(2);

async function q(client, text, values = []) { await client.query(text, values); }

async function seedDemoData() {
	const client = await pool.connect();
	const password = await bcrypt.hash(`Password@123${env.passwordPepper || ''}`, env.bcryptRounds || 12);
	const upsert = async (sql, values) => q(client, sql, values);
	try {
		await q(client, 'BEGIN');
		console.log('Planned row counts:', plannedCounts);
		console.log('Insertion order:', insertionOrder.join(' -> '));

		await upsert(`INSERT INTO organizations (id,name,slug,currency_code,fiscal_year_start_month,status)
			VALUES ($1,'Urban Furniture Demo Pvt Ltd','urban-furniture-demo','INR',4,'active')
			ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,status='active',updated_at=NOW()`, [ORG]);

		const users = [
			['Demo Owner','business_owner'],['Mira Iyer','accountant'],['Arjun Rao','accountant'],
			['Nisha Kapoor','customer'],['Dev Mehta','vendor'],
		];
		const owner = uid(1,1), accountant = uid(1,2), userIds = users.map((_, i) => uid(1,i+1));
		for (let i = 0; i < users.length; i++) await upsert(`
			INSERT INTO users (id,name,email,password_hash,role,organization_id,email_verified,status,must_change_password)
			VALUES ($1,$2,$3,$4,$5,$6,true,'active',false)
			ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,
				role=EXCLUDED.role,organization_id=EXCLUDED.organization_id,email_verified=true,status='active',must_change_password=false`,
		[userIds[i],users[i][0],`${users[i][1]}${i ? i : ''}@${emailDomain}`,password,users[i][1],ORG]);
		await upsert('UPDATE organizations SET created_by=$1,updated_by=$1 WHERE id=$2',[owner,ORG]);
		await upsert(`INSERT INTO otp_verifications (id,user_id,purpose,otp_hash,expires_at,used)
			VALUES ($1,$2,'email_verification',repeat('a',64),NOW()+INTERVAL '10 minutes',true) ON CONFLICT (id) DO NOTHING`,[uid(2,1),userIds[3]]);
		await upsert(`INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at,user_agent,ip_address)
			VALUES ($1,$2,repeat('b',64),NOW()+INTERVAL '30 days','Demo Browser','127.0.0.1')
			ON CONFLICT (id) DO UPDATE SET expires_at=EXCLUDED.expires_at,revoked=false`,[uid(3,1),userIds[3]]);

		const accounts = [['1000','Main Bank Account','asset'],['1010','Petty Cash','asset'],['1100','Accounts Receivable','asset'],['1200','Inventory','asset'],['2000','Accounts Payable','liability'],['2100','Output GST Payable','liability'],['4000','Furniture Sales','income'],['5000','Furniture Purchases','expense'],['5100','Delivery Expense','expense'],['3000','Retained Earnings','capital']];
		const acc = {};
		for (let i=0;i<accounts.length;i++) { const a=accounts[i], aid=uid(4,i+1); acc[a[0]]=aid; await upsert(`INSERT INTO accounts (id,organization_id,code,name,account_type,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,'active',$6,$6) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,account_type=EXCLUDED.account_type,status='active'`,[aid,ORG,a[0],a[1],a[2],owner]); }

		const contacts=[];
		for(let i=0;i<12;i++) contacts.push([['Aarav Shah','Kavya Nair','Rohan Desai','Meera Joshi','Ishaan Patel','Tara Menon'][i%6],'customer',`customer${i+1}@${emailDomain}`,['Mumbai','Pune','Bengaluru','Ahmedabad'][i%4]]);
		for(let i=0;i<5;i++) contacts.push([['Nilambur Timber Co.','Ebco Hardware Supply','Jaipur Fabric Mills','Bhiwandi Foam Works','Pune Powder Coating'][i],'vendor',`vendor${i+1}@${emailDomain}`,['Kochi','Mumbai','Jaipur','Thane','Pune'][i]]);
		for(let i=0;i<3;i++) contacts.push([['HomeStyle Trade Partner','Urban Office Distributors','Decora Project Furnishings'][i],'both',`partner${i+1}@${emailDomain}`,['Delhi','Hyderabad','Chennai'][i]]);
		contacts.push(['Walk-in Showroom Customer','customer',null,null],['Westside Hospitality Group','customer',`hospitality@${emailDomain}`,'Goa'],['Sustainable Materials Collective','vendor',`sustainability@${emailDomain}`,'Mysuru']);
		const contactIds=contacts.map((_,i)=>uid(5,i+1));
		for(let i=0;i<contacts.length;i++){const c=contacts[i];await upsert(`INSERT INTO contacts (id,organization_id,name,contact_type,email,mobile,city,state,pincode,portal_access_enabled,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$11) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,contact_type=EXCLUDED.contact_type,email=EXCLUDED.email,city=EXCLUDED.city,status='active'`,[contactIds[i],ORG,c[0],c[1],c[2],`98${String(10000000+i).slice(0,8)}`,c[3],c[3]?'Maharashtra':null,c[3]?`400${String(100+i).padStart(3,'0')}`:null,i<6,owner]);}

		const categoryIds=[]; for(let i=0;i<5;i++){const cid=uid(6,i+1);categoryIds.push(cid);await upsert(`INSERT INTO product_categories (id,organization_id,name,description,status,created_by,updated_by) VALUES ($1,$2,$3,$4,'active',$5,$5) ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description,status='active'`,[cid,ORG,['Living Room','Bedroom','Workspace','Outdoor','Installation Services'][i],'Demo product category',owner]);}
		const taxIds=[]; for(let i=0;i<3;i++){const tid=uid(7,i+1);taxIds.push(tid);await upsert(`INSERT INTO taxes (id,organization_id,name,rate,tax_scope,tax_account_id,status,created_by,updated_by) VALUES ($1,$2,$3,$4,'both',$5,'active',$6,$6) ON CONFLICT (id) DO UPDATE SET rate=EXCLUDED.rate,tax_account_id=EXCLUDED.tax_account_id,status='active'`,[tid,ORG,`GST ${[5,12,18][i]}%`,[5,12,18][i],acc['2100'],owner]);}
		const productIds=[]; for(let i=0;i<30;i++){const pid=uid(8,i+1);productIds.push(pid);const price=1800+i*725;await upsert(`INSERT INTO products (id,organization_id,name,sku,product_type,category_id,sales_price,cost_price,sales_tax_id,purchase_tax_id,income_account_id,expense_account_id,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,'active',$12,$12) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,sales_price=EXCLUDED.sales_price,cost_price=EXCLUDED.cost_price,status='active'`,[pid,ORG,`${['Teak Lounge Chair','Mango Console','Work Desk','Rattan Set','Assembly Visit'][i%5]} ${i+1}`,`UF-DEMO-${String(i+1).padStart(3,'0')}`,i>=25?'service':i>=22?'combo':'goods',categoryIds[i%5],money(price),money(price*.58),taxIds[i%3],acc['4000'],acc['5000'],owner]);}

		const journalIds={}; for(let i=0;i<4;i++){const jid=uid(9,i+1), type=['sales','purchase','bank','general'][i];journalIds[type]=jid;await upsert(`INSERT INTO journals (id,organization_id,name,journal_type,sequence_prefix,default_debit_account_id,default_credit_account_id,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$8) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,status='active'`,[jid,ORG,`${type[0].toUpperCase()+type.slice(1)} Journal`,type,['INV','BILL','BNK','JE'][i],acc['1000'],acc['4000'],owner]);}
		const analyticIds=[]; for(let i=0;i<5;i++){const aid=uid(10,i+1);analyticIds.push(aid);await upsert(`INSERT INTO analytic_accounts (id,organization_id,code,name,analytic_type,department,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,status='active'`,[aid,ORG,`CC-DEMO-${i+1}`,['Retail','Digital','Production','Logistics','Design'][i],i<2?'income':'expense','Demo Operations',owner]);}
		for(let i=0;i<3;i++) await upsert(`INSERT INTO budgets (id,organization_id,name,period_start,period_end,responsible_user_id,analytic_account_id,planned_amount,status,created_by,updated_by) VALUES ($1,$2,$3,'2026-04-01','2027-03-31',$4,$5,$6,$7,$4,$4) ON CONFLICT (id) DO UPDATE SET planned_amount=EXCLUDED.planned_amount,status=EXCLUDED.status`,[uid(11,i+1),ORG,['Retail plan','Production plan','Logistics plan'][i],accountant,analyticIds[i+1],[1800000,950000,420000][i],i===2?'closed':'active']);
		for(let i=0;i<6;i++) await upsert(`INSERT INTO document_sequences (id,organization_id,doc_type,fiscal_year,prefix,next_number,padding) VALUES ($1,$2,$3,'2026',$3,$4,5) ON CONFLICT (id) DO UPDATE SET next_number=EXCLUDED.next_number`,[uid(12,i+1),ORG,['PO','SO','BILL','INV','PAY','JE'][i],i+8]);

		const product=(i)=>productIds[i%30], tax=(i)=>taxIds[i%3], analytic=(i)=>analyticIds[i%5];
		async function line(table, lineId, parentColumn, parentId, i, income){const quantity=i%3+1,unit=2400+i*175,rate=[5,12,18][i%3],net=quantity*unit,vat=net*rate/100,lineNo=i%2+1;await upsert(`INSERT INTO ${table} (id,organization_id,${parentColumn},line_no,product_id,description,quantity,unit_price,tax_id,tax_rate,untaxed_amount,tax_amount,total_amount,analytic_account_id,${income?'income_account_id':'expense_account_id'}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO UPDATE SET line_no=EXCLUDED.line_no,quantity=EXCLUDED.quantity,unit_price=EXCLUDED.unit_price,total_amount=EXCLUDED.total_amount`,[lineId,ORG,parentId,lineNo,product(i),`Demo ${income?'sales':'purchase'} line`,quantity,money(unit),tax(i),rate,money(net),money(vat),money(net+vat),analytic(i),income?acc['4000']:acc['5000']]);}
		for(let i=0;i<4;i++){const net=5000+i*700,vat=net*.18,oid=uid(13,i+1);await upsert(`INSERT INTO purchase_orders (id,organization_id,po_number,vendor_contact_id,order_date,status,untaxed_amount,tax_amount,total_amount,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,total_amount=EXCLUDED.total_amount`,[oid,ORG,`PO-DEMO-${i+1}`,contactIds[12+i%5],`2026-04-${String(i+5).padStart(2,'0')}`,['confirmed','billed','draft','cancelled'][i],money(net),money(vat),money(net+vat),owner]);await line('purchase_order_lines',uid(14,i+1),'purchase_order_id',oid,i,false);await line('purchase_order_lines',uid(14,i+5),'purchase_order_id',oid,i+1,false);}
		for(let i=0;i<5;i++){const net=6500+i*800,vat=net*.18,oid=uid(15,i+1);await upsert(`INSERT INTO sales_orders (id,organization_id,so_number,customer_contact_id,order_date,status,untaxed_amount,tax_amount,total_amount,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,total_amount=EXCLUDED.total_amount`,[oid,ORG,`SO-DEMO-${i+1}`,contactIds[i%12],`2026-05-${String(i+10).padStart(2,'0')}`,['confirmed','invoiced','draft','cancelled','invoiced'][i],money(net),money(vat),money(net+vat),owner]);await line('sales_order_lines',uid(16,i+1),'sales_order_id',oid,i,true);await line('sales_order_lines',uid(16,i+6),'sales_order_id',oid,i+1,true);}

		const entryIds=[]; for(let i=0;i<12;i++){const eid=uid(17,i+1),amount=10000+i*1250;entryIds.push(eid);await upsert(`INSERT INTO journal_entries (id,organization_id,journal_id,entry_number,entry_date,reference,narration,status,is_auto_generated,posted_at,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,'Demo ledger posting','posted',true,NOW(),$7,$7) ON CONFLICT (id) DO NOTHING`,[eid,ORG,journalIds[i%3===0?'sales':i%3===1?'purchase':'bank'],`DEMO-JE-${i+1}`,`2026-${String(4+i%6).padStart(2,'0')}-${String(5+i).padStart(2,'0')}`,`DEMO-REF-${i+1}`,accountant]);await upsert(`INSERT INTO journal_entry_lines (id,organization_id,journal_entry_id,line_no,account_id,partner_contact_id,analytic_account_id,debit,credit,description) VALUES ($1,$2,$3,1,$4,$5,$6,$7,0,'Demo debit') ON CONFLICT (id) DO NOTHING`,[uid(18,i*2+1),ORG,eid,i%3===1?acc['5000']:acc['1000'],contactIds[i%20],analytic(i),money(amount)]);await upsert(`INSERT INTO journal_entry_lines (id,organization_id,journal_entry_id,line_no,account_id,partner_contact_id,analytic_account_id,debit,credit,description) VALUES ($1,$2,$3,2,$4,$5,$6,0,$7,'Demo credit') ON CONFLICT (id) DO NOTHING`,[uid(18,i*2+2),ORG,eid,i%3===1?acc['2000']:acc['4000'],contactIds[i%20],analytic(i),money(amount)]);}

		for(let i=0;i<4;i++){const net=7500+i*900,vat=net*.18,bid=uid(19,i+1);await upsert(`INSERT INTO vendor_bills (id,organization_id,bill_number,purchase_order_id,vendor_contact_id,bill_date,due_date,status,untaxed_amount,tax_amount,total_amount,amount_due,amount_paid,journal_id,journal_entry_id,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,amount_due=EXCLUDED.amount_due,amount_paid=EXCLUDED.amount_paid`,[bid,ORG,`BILL-DEMO-${i+1}`,i<3?uid(13,i+1):null,contactIds[12+i%5],`2026-06-${String(i+3).padStart(2,'0')}`,`2026-07-${String(i+3).padStart(2,'0')}`,['posted','partially_paid','paid','overdue'][i],money(net),money(vat),money(net+vat),money(i===2?0:net+vat),money(i===2?net+vat:0),journalIds.purchase,entryIds[i],accountant]);await line('vendor_bill_lines',uid(20,i+1),'vendor_bill_id',bid,i+4,false);await line('vendor_bill_lines',uid(20,i+5),'vendor_bill_id',bid,i+5,false);}
		for(let i=0;i<5;i++){const net=9000+i*900,vat=net*.18,iid=uid(21,i+1);await upsert(`INSERT INTO customer_invoices (id,organization_id,invoice_number,sales_order_id,customer_contact_id,invoice_date,due_date,status,untaxed_amount,tax_amount,total_amount,amount_due,amount_paid,journal_id,journal_entry_id,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,amount_due=EXCLUDED.amount_due,amount_paid=EXCLUDED.amount_paid`,[iid,ORG,`INV-DEMO-${i+1}`,i<4?uid(15,i+1):null,contactIds[i%12],`2026-07-${String(i+4).padStart(2,'0')}`,`2026-08-${String(i+4).padStart(2,'0')}`,['posted','partially_paid','paid','overdue','draft'][i],money(net),money(vat),money(net+vat),money(i===2?0:net+vat),money(i===2?net+vat:0),journalIds.sales,entryIds[i+4],accountant]);await line('customer_invoice_lines',uid(22,i+1),'customer_invoice_id',iid,i+1,true);await line('customer_invoice_lines',uid(22,i+6),'customer_invoice_id',iid,i+2,true);}

		for(let i=0;i<5;i++){const pid=uid(23,i+1);await upsert(`INSERT INTO payments (id,organization_id,payment_number,payment_type,contact_id,payment_method,journal_id,payment_date,amount,status,journal_entry_id,gateway_provider,gateway_payment_id,gateway_status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'posted',$10,$11,$12,$13,$14,$14) ON CONFLICT (id) DO UPDATE SET amount=EXCLUDED.amount,gateway_status=EXCLUDED.gateway_status`,[pid,ORG,`PAY-DEMO-${i+1}`,i<3?'inbound':'outbound',contactIds[i<3?i:12+i-3],['bank','card','cash'][i%3],journalIds.bank,`2026-08-${String(i+2).padStart(2,'0')}`,money(12000+i*900),entryIds[7+i],i===1?'razorpay':null,i===1?'pay_demo_2':null,i===1?'captured':null,accountant]);await upsert(`INSERT INTO payment_allocations (id,organization_id,payment_id,invoice_id,bill_id,allocated_amount) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET allocated_amount=EXCLUDED.allocated_amount`,[uid(24,i+1),ORG,pid,i<3?uid(21,i+1):null,i>=3?uid(19,i-2):null,money(5000+i*500)]);}
		await upsert(`INSERT INTO attachments (id,organization_id,entity_type,entity_id,file_name,file_path,file_size,mime_type,created_by) VALUES ($1,$2,'customer_invoice',$3,'invoice-demo.pdf','attachments/demo/invoice.pdf',184320,'application/pdf',$4) ON CONFLICT (id) DO NOTHING`,[uid(25,1),ORG,uid(21,1),accountant]);
		await upsert(`INSERT INTO attachments (id,organization_id,entity_type,entity_id,file_name,file_path,file_size,mime_type,created_by) VALUES ($1,$2,'vendor_bill',$3,'receipt-demo.jpg','attachments/demo/receipt.jpg',92160,'image/jpeg',$4) ON CONFLICT (id) DO NOTHING`,[uid(25,2),ORG,uid(19,1),accountant]);
		for(let i=0;i<12;i++) await upsert(`INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,before,after,ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,'127.0.0.1') ON CONFLICT (id) DO UPDATE SET action=EXCLUDED.action,after=EXCLUDED.after`,[uid(26,i+1),ORG,i%2?accountant:owner,['create','update','post','archive'][i%4],i%2?'customer_invoice':'product',i%2?uid(21,i%5+1):product(i),i%3?null:JSON.stringify({status:'draft'}),JSON.stringify({status:i%4===3?'archived':'active'})]);
		for(let i=0;i<5;i++) await upsert(`INSERT INTO notifications (id,organization_id,recipient_email,subject,body_html,trigger_event,entity_type,entity_id,status,sent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,sent_at=EXCLUDED.sent_at`,[uid(27,i+1),ORG,`${users[i][1]}@${emailDomain}`,['Invoice posted','Payment received','Bill due soon'][i%3],'<p>Demo notification</p>',['invoice_posted','payment_received','bill_due'][i%3],i%2?'payment':'customer_invoice',i%2?uid(23,i%5+1):uid(21,i%5+1),i===3?'failed':i===4?'pending':'sent',i===3||i===4?null:new Date('2026-08-12T09:00:00Z')]);

		await q(client,'COMMIT');
		const counts={};
		for(const table of insertionOrder){
			const query = table === 'organizations'
				? ['SELECT COUNT(*)::int AS count FROM organizations WHERE id=$1',[ORG]]
				: table === 'users'
					? ['SELECT COUNT(*)::int AS count FROM users WHERE organization_id=$1',[ORG]]
					: table === 'otp_verifications' || table === 'refresh_tokens'
						? [`SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id=ANY($1::uuid[])`,[userIds]]
						: [`SELECT COUNT(*)::int AS count FROM ${table} WHERE organization_id=$1`,[ORG]];
			counts[table]=(await client.query(query[0],query[1])).rows[0].count;
		}
		console.log('Demo seed committed. Row counts:',counts); return counts;
	} catch(error) { await q(client,'ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
}

if(require.main===module) seedDemoData().then(()=>process.exit(0)).catch(error=>{console.error('Demo seed rolled back:',error.message);process.exit(1);});
module.exports={seedDemoData,plannedCounts,insertionOrder};