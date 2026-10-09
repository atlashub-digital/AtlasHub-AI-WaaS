import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { withDb } from './context.js';
const issuer=process.env.JWT_ISSUER;
const audience=process.env.JWT_AUDIENCE;
if(!issuer||!audience) throw new Error('JWT_ISSUER and JWT_AUDIENCE required');
if(process.env.AUTH_MODE==='staging'&&process.env.NODE_ENV==='production') throw new Error('Staging authentication forbidden in production');
// Anything reachable through the public HTTPS edge must verify real Supabase tokens (JWKS), never the shared HS256 secret.
if(process.env.AUTH_MODE==='staging'&&process.env.PUBLIC_INGRESS==='1') throw new Error('Staging authentication forbidden behind the public ingress');
if(process.env.PUBLIC_INGRESS==='1'&&!process.env.JWT_JWKS_URL) throw new Error('JWT_JWKS_URL required behind the public ingress');
const jwks=process.env.JWT_JWKS_URL?createRemoteJWKSet(new URL(process.env.JWT_JWKS_URL)):undefined;
export async function subject(req:any){
 let sub:string;
 try{
 const header=req.headers.authorization;
 if(typeof header!=='string'||!header.startsWith('Bearer ')) throw new Error();
 const key=process.env.AUTH_MODE==='staging'?new TextEncoder().encode(process.env.STAGING_JWT_SECRET):jwks;
 if(!key||(process.env.AUTH_MODE==='staging'&&(process.env.STAGING_JWT_SECRET?.length??0)<32)) throw new Error();
 const options={issuer,audience,algorithms:process.env.AUTH_MODE==='staging'?['HS256']:['RS256','ES256']};
 const {payload}=await (typeof key==='function'?jwtVerify(header.slice(7),key,options):jwtVerify(header.slice(7),key,options));
 if(!payload.sub) throw new Error();sub=payload.sub;
 }catch{throw new UnauthorizedException();}
 return sub;
}
export async function identity(req:any,tenantId?:string,write=false){
 const sub=await subject(req);
 // Only the caller's own memberships are visible before a tenant is bound (RLS own_memberships).
 const memberships=await withDb({userId:sub},tx=>tx.membership.findMany({where:{userId:sub,status:'active',...(tenantId?{tenantId}:{})}}));
 if(!memberships.length) throw new ForbiddenException();
 const membership=memberships[0];
 if(!tenantId&&memberships.length>1) throw new ForbiddenException('Select a tenant');
 if(write&&!['tenant_admin','atlas_operator','atlas_engineer','atlas_owner'].includes(membership.role)) throw new ForbiddenException();
 return {sub,tenantId:membership.tenantId,role:membership.role};
}
