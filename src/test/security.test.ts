import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRevenueCatServer, VERSION } from '../index';
import { readFileSync } from 'node:fs';

// Fictional fixture, never a real account key or project.
const fixtureKey = 'fixture-secret-do-not-send';
const env = { REVENUECAT_API_KEY: fixtureKey, REVENUECAT_PROJECT_ID: 'projFixture' };
const metric = { id:'mrr', name:'MRR', unit:'$', period:'P0D', value:42 };
const overview = { currency:"USD", metrics:[metric] };
const chart = { display_name:'MRR', resolution:'2', values:[{cohort:1759276800,value:10,incomplete:false},{cohort:1761955200,value:20,incomplete:false}], summary:{} };
const json = (value: unknown) => new Response(JSON.stringify(value));
async function withClient(fetcher: typeof fetch, run: (client: Client) => Promise<void>) {
  const server = createRevenueCatServer(env, fetcher);
  const client = new Client({name:'fixture-client',version:'1'});
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  try { await Promise.all([server.connect(serverSide),client.connect(clientSide)]); await run(client); }
  finally { await client.close(); await server.close(); }
}
const text = (value: unknown) => JSON.stringify(value);

test('configuration fails closed without leaking values', () => {
  assert.throws(()=>createRevenueCatServer({}), /REVENUECAT_API_KEY/);
  assert.throws(()=>createRevenueCatServer({...env,REVENUECAT_PROJECT_ID:'../other'}), /valid REVENUECAT_PROJECT_ID/);
  assert.throws(()=>createRevenueCatServer({...env,REVENUECAT_API_KEY:'line\nbreak'}), /REVENUECAT_API_KEY/);
});
test('four advertised read tools expose no key/project arguments; version agrees with package', async () => {
  await withClient(async()=>{throw new Error('must not fetch')}, async(client)=>{
    assert.equal(client.getServerVersion()?.version, VERSION);
    assert.equal(VERSION, JSON.parse(readFileSync('package.json','utf8')).version);
    const result=await client.listTools(); assert.equal(result.tools.length,4);
    for(const tool of result.tools) {
      assert.equal(tool.inputSchema.additionalProperties,false);
      assert.ok(!Object.hasOwn(tool.inputSchema.properties??{},'api_key'));
      assert.ok(!Object.hasOwn(tool.inputSchema.properties??{},'project_id'));
      assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true});
    }
    assert.ok(!text(result).includes(fixtureKey));
  });
});
test('legacy credentials, cross-project selection, unknown fields and malformed values fail before fetch', async () => {
  let requests=0;
  await withClient(async()=>{requests++;return json(overview)},async(client)=>{
    const cases: Array<[string,Record<string,unknown>]> = [
      ['get_overview',{api_key:fixtureKey}], ['get_overview',{project_id:'projOther'}],
      ['get_overview',{currency:'USD&project_id=projOther'}], ['get_overview',{currency:42}],
      ['get_chart_options',{chart_name:'../other'}], ['get_chart_options',{chart_name:'mrr?secret=x'}],
      ['get_chart',{chart_name:'mrr',start_date:'2026-02-30'}],
      ['get_chart',{chart_name:'mrr',start_date:'2026-10-20',end_date:'2026-10-19'}],
      ['get_chart',{chart_name:'mrr',start_date:'2026-10-01',resolution:'9'}],
      ['get_chart',{chart_name:'mrr',start_date:'2026-10-01',segment:'country&api_key=x'}],
      ['get_chart',{chart_name:'mrr'}], ['get_overview',{unexpected:'bad'}], ['get_overview',{constructor:'bad'}],
    ];
    for(const [name,args] of cases) {
      const result=await client.callTool({name,arguments:args}); assert.equal(result.isError,true,JSON.stringify({name,args}));
      assert.ok(!text(result).includes(fixtureKey));
    }
    const unknown=await client.callTool({name:fixtureKey,arguments:{}});
    assert.equal(unknown.isError,true); assert.ok(!text(unknown).includes(fixtureKey));
  });
  assert.equal(requests,0);
});
test('all requests target the configured project and fixed HTTPS origin with redirects disabled',async()=>{
  const seen: string[]=[];
  await withClient(async(input,init)=>{
    const url=new URL(String(input)); seen.push(url.pathname);
    assert.equal(url.origin,'https://api.revenuecat.com');
    assert.ok(url.pathname.startsWith('/v2/projects/projFixture/'));
    assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');
    assert.ok(init?.signal); assert.equal((init?.headers as Record<string,string>).Authorization,`Bearer ${fixtureKey}`);
    return url.pathname.endsWith('/overview') ? json(overview) : url.pathname.endsWith('/options') ? json({resolutions:[],segments:null,filters:null}) : json(chart);
  },async(client)=>{
    const calls = [
      ['get_overview',{currency:'CAD'}],
      ['get_chart',{chart_name:'mrr',start_date:'2026-10-01',end_date:'2026-10-02',resolution:'0',segment:'country'}],
      ['get_chart_options',{chart_name:'mrr'}],['analyze_subscription_health',{currency:'CAD'}],
    ] as const;
    for(const [name,args] of calls) {
      const result=await client.callTool({name,arguments:args}); assert.notEqual(result.isError,true,text(result));
    }
  });
  assert.equal(seen.length,7);
});
test('upstream errors and exceptions never expose raw bodies, key or stack',async()=>{
  for(const fetcher of [
    async()=>new Response(`private-body ${fixtureKey}`,{status:401}),
    async()=>new Response(`private-body ${fixtureKey}`,{status:429}),
    async()=>new Response('redirect',{status:302,headers:{location:'https://example.invalid'}}),
    async()=>{throw new Error(`private-body ${fixtureKey}`)},
    async()=>new Response(`malformed-json ${fixtureKey}`),
    async()=>json({metrics:null}),
  ] as Array<typeof fetch>) {
    await withClient(fetcher,async(client)=>{
      const result=await client.callTool({name:'get_overview',arguments:{}});
      assert.equal(result.isError,true); assert.ok(!text(result).includes(fixtureKey));
      assert.ok(!text(result).includes('private-body')); assert.ok(!text(result).includes(' at '));
    });
  }
});
test('oversized bodies are rejected by declared length and actual streamed size',async()=>{
  for(const response of [
    new Response('{}',{headers:{'content-length':String(2*1024*1024+1)}}),
    new Response('x'.repeat(2*1024*1024+1)),
  ]) await withClient(async()=>response,async(client)=>{
    const result=await client.callTool({name:'get_overview',arguments:{}});
    assert.equal(result.isError,true);assert.match(text(result),/2 MiB/);
  });
});
test('upstream echo of the configured key is redacted in successful reports',async()=>{
  await withClient(async()=>json({currency:"USD",metrics:[{...metric,name:fixtureKey}]}),async(client)=>{
    const result=await client.callTool({name:'get_overview',arguments:{}});
    assert.notEqual(result.isError,true);assert.ok(!text(result).includes(fixtureKey));assert.match(text(result),/redacted/);
  });
});
test('missing data stays unavailable; zero baseline is not a decline or Infinity; non-USD stays correct',async()=>{
  for(const metrics of [[],[{...metric,value:0}], [{...metric,value:12}]]) {
    await withClient(async(input)=>String(input).includes('/overview')?json({currency:"CAD",metrics}):json({...chart,values:[{cohort:1,value:0,incomplete:false},{cohort:2,value:12,incomplete:false}]}),async(client)=>{
      const result=await client.callTool({name:'analyze_subscription_health',arguments:{currency:'CAD'}});
      assert.notEqual(result.isError,true); const report=text(result);
      assert.match(report,/not computable/);assert.match(report,/Active trials: data unavailable/);
      assert.ok(!/Infinity|declining|healthy range|\$/.test(report));
      if(metrics.length) assert.match(report,new RegExp(`MRR: CAD ${metrics[0].value}`));
      else assert.match(report,/MRR: data unavailable/);
    });
  }
});
test('segmented and incomplete chart values do not invent additive MRR trends',async()=>{
  for(const values of [
    [{cohort:1,value:{a:1,b:2},incomplete:false},{cohort:2,value:{a:2,b:3},incomplete:false}],
    [{cohort:1,value:1,incomplete:true},{cohort:2,value:2,incomplete:true}],
    [{cohort:1,value:1,incomplete:false,measure:0},{cohort:2,value:3,incomplete:false,measure:1}],
    [{cohort:1,value:1,incomplete:false},{cohort:1,value:3,incomplete:false}],
    [{cohort:1,value:1},{cohort:2,value:3}],
    [],
  ]) await withClient(async(input)=>String(input).includes('/overview')?json(overview):json({...chart,values}),async(client)=>{
    const result=await client.callTool({name:'analyze_subscription_health',arguments:{}});
    assert.notEqual(result.isError,true);assert.match(text(result),/not computable/);
  });
});
test('real stdio advertises secure schema without making authenticated API calls',async()=>{
  const client = new Client({name:'stdio-fixture',version:'1'});
  const transport = new StdioClientTransport({command:process.execPath,args:['dist/index.js'],env:{...process.env,...env} as Record<string,string>,stderr:'pipe'});
  let errors='';transport.stderr?.on('data',(chunk)=>{errors+=String(chunk)});
  try {
    await client.connect(transport);
    const tools=await client.listTools();assert.equal(tools.tools.length,4);
    const result=await client.callTool({name:'get_overview',arguments:{api_key:fixtureKey}});
    assert.equal(result.isError,true);assert.ok(!text(result).includes(fixtureKey));
  } finally {await client.close();}
  assert.ok(!errors.includes(fixtureKey));
});
test('slow upstream requests abort after the fixed deadline', {timeout:15000},async()=>{
  await withClient(async(_input,init)=>new Promise((_resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(new Error(fixtureKey)),{once:true});
  }),async(client)=>{
    const result=await client.callTool({name:'get_overview',arguments:{}});
    assert.equal(result.isError,true);assert.ok(!text(result).includes(fixtureKey));
  });
});

test('raw chart output preserves cohort counts, period units, array forms and nullable summaries',async()=>{
  const payload={...chart,yaxis_currency:'USD',periods:[{display_name:'New customers',unit:'#',scale:'absolute'},{display_name:'Month 0',unit:'$',scale:'absolute'}],values:[{cohort:1,period:0,value:100},{cohort:1,period:1,value:5}],summary:null};
  for(const data of [payload,{...payload,summary:undefined}, {...payload,values:[[1,2,3]]}]) {
    await withClient(async()=>json(data),async(client)=>{
      const result=await client.callTool({name:'get_chart',arguments:{chart_name:'cohort_explorer',start_date:'2026-01-01'}});
      assert.notEqual(result.isError,true,text(result));const report=text(result);
      assert.match(report,/New customers/);assert.match(report,/Month 0/);
      assert.match(report,/summary_status/);assert.match(report,/unavailable/);
      assert.ok(!report.includes('USD100'));assert.ok(!report.includes('USD 100'));
      const content=(result.content as Array<{type:string,text:string}>)[0].text;
      const raw=JSON.parse(content.slice(content.indexOf('{')));
      assert.deepEqual(raw.values,data.values);assert.deepEqual(raw.metadata.periods,data.periods);
    });
  }
});
test('documented hyphenated chart identifiers reach only the configured chart path',async()=>{
  await withClient(async(input)=>{assert.equal(new URL(String(input)).pathname,'/v2/projects/projFixture/charts/non-subscription_purchases');return json(chart)},async(client)=>{
    const result=await client.callTool({name:'get_chart',arguments:{chart_name:'non-subscription_purchases',start_date:'2026-01-01'}});
    assert.notEqual(result.isError,true,text(result));
  });
});
test('overview uses the response currency and refuses missing currency',async()=>{
  await withClient(async(input)=>String(input).includes('/overview')?json({...overview,currency:'EUR'}):json(chart),async(client)=>{
    for(const name of ['get_overview','analyze_subscription_health']) {
      const result=await client.callTool({name,arguments:{currency:'CAD'}});
      assert.notEqual(result.isError,true);assert.match(text(result),/EUR 42/);assert.ok(!text(result).includes('CAD 42'));
    }
  });
  await withClient(async()=>json({metrics:[metric]}),async(client)=>{
    const result=await client.callTool({name:'get_overview',arguments:{}});assert.equal(result.isError,true);
  });
});
test('malformed or null options are unavailable; only empty arrays establish no options',async()=>{
  for(const data of [{resolutions:[{}],segments:[{}],filters:null},{resolutions:null}]) {
    await withClient(async()=>json(data),async(client)=>{
      const result=await client.callTool({name:'get_chart_options',arguments:{chart_name:'mrr'}});
      assert.notEqual(result.isError,true);assert.match(text(result),/unavailable/);assert.ok(!/undefined|none reported/.test(text(result)));
    });
  }
  await withClient(async()=>json({resolutions:[],segments:[],filters:[]}),async(client)=>{
    const result=await client.callTool({name:'get_chart_options',arguments:{chart_name:'mrr'}});assert.match(text(result),/none reported/);
  });
});
test('non-finite JSON numbers and excessive formatted output fail safely',async()=>{
  for(const response of [new Response('{"currency":"USD","metrics":[{"name":"MRR","value":1e999,"period":"P0D"}]}'),json({...overview,metrics:[{...metric,name:'x'.repeat(66000)}]})]) {
    await withClient(async()=>response,async(client)=>{
      const result=await client.callTool({name:'get_overview',arguments:{}});assert.equal(result.isError,true);assert.ok(!text(result).includes(fixtureKey));
    });
  }
});
