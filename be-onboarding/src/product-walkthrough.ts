import {db} from './db';
import {AuthContext} from './auth';
import {walkthrough, allowedSteps, SCHEMA_VERSION} from './registry';

export async function productState(auth: AuthContext) {
  const screens = walkthrough(auth);
  const key = {user_id: auth.userId, home_id: auth.homeId, version: SCHEMA_VERSION};
  await db('product_walkthrough').insert(key).onConflict(['user_id','home_id','version']).ignore();
  const row = await db('product_walkthrough').where(key).first();
  const selected = screens.find(s => s.screen_id === row.screen_id) ?? screens[0] ?? null;
  const fallback = !!row.screen_id && selected?.screen_id !== row.screen_id;
  if (fallback && selected) await db('product_walkthrough').where(key).update({screen_id:selected.screen_id, task_id:null,updated_at:new Date()});
  const task = selected?.tasks.find(t => t.step_id === row.task_id) ?? selected?.tasks[0] ?? null;
  return {screens, selected, task, viewed: row.viewed as string[], acknowledged: row.acknowledged as string[],
    fallback: fallback ? 'Your saved screen is no longer eligible. The first eligible screen is selected.' : null,
    notice: screens.length ? null : 'No walkthrough guidance is verified for this home type and role.'};
}
export async function selectProduct(auth: AuthContext, screenId: string, taskId?: string, acknowledge?: boolean) {
  const state = await productState(auth);
  const target = state.screens.find(s => s.screen_id === screenId);
  if (!target) throw new Error('Screen unavailable');
  const task = target.tasks.find(t => t.step_id === taskId) ?? target.tasks[0];
  await db.transaction(async trx => {
    const key = {user_id: auth.userId, home_id: auth.homeId, version: SCHEMA_VERSION};
    const row = await trx('product_walkthrough').where(key).forUpdate().first();
    await trx('product_walkthrough').where(key).update({screen_id: screenId, task_id: task?.step_id ?? null,
      viewed: JSON.stringify([...new Set([...row.viewed, screenId])]),
      acknowledged: JSON.stringify(acknowledge && row.screen_id ? [...new Set([...row.acknowledged, row.screen_id])] : row.acknowledged),
      updated_at: new Date()});
  });
  return productState(auth);
}
export function productReply(message: string, state: Awaited<ReturnType<typeof productState>>, proposal?: {intent?: string; step_id?: string; message?: string}) {
  const text = message.toLowerCase();
  // Record questions are product help, never a tour continuation.
  const recordQuestion = /\b(this|that|my|the) (nurse|senior|care|resident|lead|record)/i.test(message);
  if (recordQuestion && /nurse/i.test(message)) return {intent:'explain', message:'For a nurse lead, select + Add New, enter the details and Save. Further nurse-lead workflow steps need verification.', navigation:null};
  const next = state.screens[state.screens.findIndex(s => s.screen_id === state.selected?.screen_id)+1];
  if ((proposal?.intent === 'continue' && !state.screens.some(s => text.includes(s.screen_title.toLowerCase()))) || /^(what[’']?s next\??|what is next\??|next|done|continue|move on)$/i.test(message.trim()))
    return {intent:'continue', message: next ? `Next: ${next.module_title} → ${next.screen_title}. Select Open to continue.` : 'You have reached the last eligible walkthrough screen.', navigation:next ? {step_id:next.step_id, screen_id:next.screen_id} : null};
  if (recordQuestion) return {intent:'explain', message: state.task?.guidance ?? 'Choose an eligible task for product guidance. Record workflow details require verification.', navigation:null};
  const mentioned = state.screens.find(s => text.includes(s.screen_title.toLowerCase()));
  if (/\b(open|go to)\b/i.test(message) || proposal?.intent === 'open_step') {
    const target = mentioned ?? state.screens.find(s => s.tasks.some(t => t.step_id === proposal?.step_id));
    if (target) return {intent:'open_step',message:`Open ${target.module_title} → ${target.screen_title}.`,navigation:{step_id:target.step_id,screen_id:target.screen_id}};
  }
  const task = mentioned?.tasks[0] ?? state.task;
  return {intent:'explain',message: mentioned ? `${mentioned.screen_title}: ${task?.guidance}` : proposal?.message ?? task?.guidance ?? state.notice, navigation:null};
}
