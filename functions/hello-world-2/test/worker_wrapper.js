import { onInvoke } from './src/function';

/* This is a wrapper for unit testing. */
export default {
	async fetch(request, env, ctx) {
		return onInvoke(request, env);
	},
};
