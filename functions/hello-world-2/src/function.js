export async function onInvoke(request, env) {
	return new Response(JSON.stringify({ message: 'Hello World v2!' }));
}
