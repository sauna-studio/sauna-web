<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		readManagedPasskeys,
		authorizePasskeyAddition,
		completePasskeyAddition,
		revokeManagedPasskey,
		readSession,
		type AuthSession,
		type ManagedPasskey,
		type PasskeyManagementOptions
	} from './client.js';
	interface Props {
		session: AuthSession;
		supported: boolean;
		onChanged: () => void;
		onSessionLost: () => void;
		busy?: boolean;
	}
	let { session, supported, onChanged, onSessionLost, busy = $bindable(false) }: Props = $props();
	let credentials = $state<ManagedPasskey[]>([]);
	let loaded = $state(false);
	let message = $state('');
	let creationOptions = $state<PasskeyManagementOptions | null>(null);
	let selectedID = $state<string | null>(null);
	const abort = new AbortController();
	onDestroy(() => {
		abort.abort();
		busy = false;
	});
	onMount(() => {
		void load();
	});
	async function failure() {
		if (abort.signal.aborted) return;
		creationOptions = null;
		selectedID = null;
		message = '操作を完了できませんでした。キャンセルした場合も、最初から確認し直してください。';
		try {
			if (!(await readSession(abort.signal)) && !abort.signal.aborted) onSessionLost();
		} catch {
			/* A network failure alone does not prove revocation; the server still validates each operation. */
		}
	}
	async function load() {
		busy = true;
		try {
			const result = await readManagedPasskeys(abort.signal);
			if (abort.signal.aborted) return;
			credentials = result;
			loaded = true;
			message = '';
		} catch {
			await failure();
		} finally {
			if (!abort.signal.aborted) busy = false;
		}
	}
	async function authorizeAddition() {
		busy = true;
		message = '';
		selectedID = null;
		try {
			const result = await authorizePasskeyAddition(session.csrfToken, abort.signal);
			if (!abort.signal.aborted) creationOptions = result;
		} catch {
			await failure();
		} finally {
			if (!abort.signal.aborted) busy = false;
		}
	}
	async function add() {
		if (!creationOptions) return;
		busy = true;
		message = '';
		const options = creationOptions;
		creationOptions = null;
		try {
			await completePasskeyAddition(options, session.csrfToken, abort.signal);
			if (!abort.signal.aborted) onChanged();
		} catch {
			await failure();
		} finally {
			if (!abort.signal.aborted) busy = false;
		}
	}
	async function revoke() {
		if (!selectedID) return;
		busy = true;
		message = '';
		const target = selectedID;
		selectedID = null;
		try {
			await revokeManagedPasskey(target, session.csrfToken, abort.signal);
			if (!abort.signal.aborted) onChanged();
		} catch {
			await failure();
		} finally {
			if (!abort.signal.aborted) busy = false;
		}
	}
</script>

<section class="space-y-4 border-t border-border pt-5" aria-labelledby="passkey-management">
	<h2 id="passkey-management" class="text-lg font-semibold">Passkeyの管理</h2>
	<p class="text-sm text-muted-foreground">
		追加・失効には、登録済みのPasskeyでの確認が必要です。変更後はすべてのセッションからログアウトします。
	</p>
	{#if loaded}
		<ul class="space-y-3" data-testid="managed-passkeys">
			{#each credentials as credential, index (credential.credentialID)}
				<li class="rounded-lg border border-border p-3">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p class="font-medium">Passkey {index + 1}</p>
							<p class="text-sm text-muted-foreground">
								登録日: {new Date(credential.createdAtUnixSeconds * 1000).toLocaleDateString(
									'ja-JP'
								)}
							</p>
							{#if credential.isCurrentSessionCredential}<p class="text-sm">
									今回のログインに使用
								</p>{/if}
						</div>
						<Button
							variant="outline"
							disabled={!supported || busy || credentials.length < 2 || !!creationOptions}
							onclick={() => {
								selectedID = credential.credentialID;
								message = '';
							}}
							aria-label={`Passkey ${index + 1}を失効する`}>失効する</Button
						>
					</div>
				</li>
			{/each}
		</ul>
		{#if credentials.length < 2}<p class="text-sm">
				最後のPasskeyは失効できません。先に予備のPasskeyを追加してください。
			</p>{/if}
		{#if selectedID}
			<div class="space-y-3 rounded-lg border border-border p-4">
				<p>
					Passkey {credentials.findIndex((item) => item.credentialID === selectedID) +
						1}を失効します。別の登録済みPasskeyで確認してください。
				</p>
				<Button disabled={!supported || busy} onclick={revoke}>別のPasskeyで確認して失効</Button>
				<Button
					variant="outline"
					disabled={busy}
					onclick={() => {
						selectedID = null;
					}}>戻る</Button
				>
			</div>
		{:else if creationOptions}
			<div class="space-y-3 rounded-lg border border-border p-4">
				<p>確認できました。新しく使うPasskeyを登録してください。</p>
				<Button disabled={!supported || busy} onclick={add}>新しいPasskeyを登録</Button>
				<Button
					variant="outline"
					disabled={busy}
					onclick={() => {
						creationOptions = null;
					}}>追加をやめる</Button
				>
			</div>
		{:else}
			<Button
				variant="outline"
				disabled={!supported || busy || credentials.length >= 10}
				onclick={authorizeAddition}>既存のPasskeyで確認して追加</Button
			>
		{/if}
		{#if credentials.length >= 10}<p class="text-sm">Passkeyは10個まで登録できます。</p>{/if}
	{:else}
		<Button variant="outline" disabled={busy} onclick={load}>Passkey一覧を再読み込み</Button>
	{/if}
	<p class="text-sm" aria-live="polite" data-testid="credential-message">{message}</p>
	<p class="text-sm text-muted-foreground">
		一覧は端末数ではありません。すべてのPasskeyを失った場合のアカウント回復は、まだ利用できません。
	</p>
</section>
