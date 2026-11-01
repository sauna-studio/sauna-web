<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import CredentialManager from '#lib/auth/credential-manager.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import {
		supportsPasskeys,
		readSession,
		authenticate,
		endSession,
		type AuthSession
	} from '#lib/auth/client.js';
	let session = $state<AuthSession | null>(null);
	let ready = $state(false);
	let supported = $state(false);
	let busy = $state(false);
	let message = $state('');
	$effect(() => {
		if (!session) return;
		const expiresAt = session.expiresAtUnixSeconds;
		const timer = window.setInterval(() => {
			if (Date.now() >= expiresAt * 1000) {
				session = null;
				message = 'セッションの有効期限が切れました。再度ログインしてください。';
			}
		}, 1000);
		return () => window.clearInterval(timer);
	});
	onMount(() => {
		supported = supportsPasskeys();
		void readSession()
			.then((value) => {
				session = value;
			})
			.catch(() => {
				message = '認証サービスに接続できません。時間をおいて再試行してください。';
			})
			.finally(() => {
				ready = true;
			});
	});
	async function signIn(register: boolean) {
		busy = true;
		message = '';
		try {
			session = await authenticate(register);
			message = register
				? 'Passkeyを登録しました。続けてログインしてください。'
				: 'Passkeyでログインしました。';
		} catch {
			message = '認証を完了できませんでした。キャンセルした場合は再試行できます。';
		} finally {
			busy = false;
		}
	}
	async function signOut(all: boolean) {
		if (!session) return;
		busy = true;
		message = '';
		try {
			await endSession(session.csrfToken, all);
			session = null;
			message = 'ログアウトしました。';
		} catch {
			message = 'ログアウトできませんでした。再試行してください。';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head
	><title>Passkeyでログイン | Sauna Studio</title><meta
		name="robots"
		content="noindex"
	/></svelte:head
>
<main class="min-h-screen bg-background px-5 py-12 text-foreground">
	<div class="mx-auto max-w-xl space-y-6">
		<a class="text-sm underline" href={resolve('/')}>ホームに戻る</a>
		<Card.Root
			><Card.Header
				><Card.Title><h1 class="text-2xl font-semibold">Passkeyでログイン</h1></Card.Title
				><Card.Description>アカウントの登録とログインにはPasskeyを使います。</Card.Description
				></Card.Header
			>
			<Card.Content class="space-y-5">
				<p data-testid="session-status" aria-live="polite">
					{!ready
						? '確認しています。'
						: session
							? 'ログインしています。'
							: 'ログインしていません。'}
				</p>
				{#if ready && !supported}<p>最新のPasskey対応ブラウザーをご利用ください。</p>{/if}
				{#if session}
					<CredentialManager
						{supported}
						{session}
						bind:busy
						onChanged={() => {
							session = null;
							message =
								'Passkeyを変更しました。すべてのセッションからログアウトしました。再度ログインしてください。';
						}}
						onSessionLost={() => {
							session = null;
							message = 'セッションが失効または変更されました。再度ログインしてください。';
						}}
					/>
					<Button disabled={busy} onclick={() => signOut(false)}>ログアウト</Button>
					<Button variant="outline" disabled={busy} onclick={() => signOut(true)}
						>すべてのセッションからログアウト</Button
					>
				{:else}
					<div class="flex flex-wrap gap-3">
						<Button
							variant="outline"
							disabled={!ready || !supported || busy}
							onclick={() => signIn(true)}>Passkeyを登録</Button
						>
						<Button disabled={!ready || !supported || busy} onclick={() => signIn(false)}
							>Passkeyでログイン</Button
						>
					</div>
				{/if}
				<p role="status" class="text-sm">{message}</p>
				<p class="text-sm text-muted-foreground">
					登録後は署名によるログインが必要です。現在はローカル検証用で、予約・決済は利用できません。
				</p>
			</Card.Content>
		</Card.Root>
	</div>
</main>
