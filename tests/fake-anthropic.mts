// Stands in for @anthropic-ai/sdk in the route test. It records every request
// and answers from globalThis.__fake: { comp: the generation's text, repair: the
// repair call's text, or an Error to throw }.
type Fake = { calls: Array<{ kind: "stream" | "create"; params: any }>; comp: string; repair: string | Error };
const fake = (): Fake => (globalThis as any).__fake;
const reply = (text: string) => ({ content: [{ type: "text", text }] });

export default class Anthropic {
  constructor(_opts: unknown) {}
  messages = {
    stream: (params: any) => {
      fake().calls.push({ kind: "stream", params });
      return { finalMessage: async () => reply(fake().comp) };
    },
    create: async (params: any) => {
      fake().calls.push({ kind: "create", params });
      const r = fake().repair;
      if (r instanceof Error) throw r;
      return reply(r);
    },
  };
}
