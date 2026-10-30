// POST /solicitudes keeps a «Pedir acceso» request; GET tells the page whether the form is on.
import { describeForm, submit } from '../access/request.mjs';

export const onRequestGet = ({ env }) => describeForm(env, { now: new Date() });

export const onRequestPost = ({ request, env }) => submit(request, env, { now: new Date(), fetchImpl: fetch });
