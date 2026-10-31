<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { Moon, Sun, Waves, Flame, Tent, ArrowRight } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient as zod4Client } from 'sveltekit-superforms/adapters/zod4';
	import { partyPreviewSchema } from '#lib/forms/party.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let dark = $state(false);
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let previewGuests = $state<number | null>(null);
	const { form, errors, enhance, submitting } = superForm(
		untrack(() => data.preview),
		{
			SPA: true,
			validationMethod: 'submit-only',
			resetForm: false,
			validators: zod4Client(partyPreviewSchema),
			onUpdate: ({ form: result }) => {
				previewGuests = result.valid ? result.data.guests : null;
			}
		}
	);
	let previewMessage = $derived(
		previewGuests === null ? '' : `${previewGuests}人で過ごす時間をイメージしました。`
	);
</script>

<svelte:head>
	<title>Sauna Studio — 川のそばで、ひと息。</title>
	<meta
		name="description"
		content="川沿いのサウナで過ごすひととき。Sauna Studioの予約サービスは現在準備中です。"
	/>
</svelte:head>

<div class:dark class="app-shell min-h-screen bg-background text-foreground">
	<a class="skip-link" href="#main">本文へ移動</a>
	<header class="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
		<a
			href={resolve('/')}
			class="flex items-center gap-2 text-lg font-semibold tracking-tight"
			aria-label="Sauna Studio ホーム"
			><Waves aria-hidden="true" class="size-6 text-primary" /> Sauna Studio</a
		>
		<Button
			variant="outline"
			size="icon"
			aria-label={dark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
			onclick={() => (dark = !dark)}
		>
			{#if dark}<Sun aria-hidden="true" class="size-4" />{:else}<Moon
					aria-hidden="true"
					class="size-4"
				/>{/if}
		</Button>
	</header>
	<main id="main" class="mx-auto max-w-6xl px-6 pb-16 sm:px-10">
		<section
			class="grid gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:py-20"
			aria-labelledby="hero-title"
		>
			<div>
				<p class="mb-5 text-sm font-semibold tracking-[.2em] text-primary">RIVERSIDE SAUNA</p>
				<h1 id="hero-title" class="text-5xl leading-tight font-semibold tracking-tight sm:text-6xl">
					川のそばで、<br />ひと息。
				</h1>
				<p class="mt-6 max-w-md text-base leading-8 text-muted-foreground">
					あたたまって、涼んで、何もしない。<br />自然のリズムに合わせて過ごす時間を。
				</p>
				<Badge variant="secondary" class="mt-7">予約サービスは準備中です</Badge>
				<p class="mt-3 text-sm leading-6 text-muted-foreground">
					この画面では予約・空き状況の確認・決済はできません。
				</p>
			</div>
			<div
				class="river-art relative flex aspect-[5/4] items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-secondary"
				aria-hidden="true"
			>
				<div class="sun-orb absolute top-9 right-10 size-24 rounded-full bg-primary/20"></div>
				<Waves class="relative size-44 text-primary/70" strokeWidth={0.8} />
				<span class="absolute bottom-7 left-8 text-xs tracking-[.25em] text-muted-foreground"
					>WARM · COOL · REST</span
				>
			</div>
		</section>
		<section aria-labelledby="experience-title" class="mb-14">
			<h2 id="experience-title" class="mb-6 text-2xl font-semibold tracking-tight">
				過ごし方を、ゆっくり選ぶ。
			</h2>
			<div class="grid gap-4 md:grid-cols-3">
				{#each [{ title: '貸切サウナ', text: '大切な人と、自分たちのペースで。', icon: Flame }, { title: '共用サウナ', text: '熱と静けさを、気軽に楽しむ。', icon: Waves }, { title: 'テントレンタル', text: '川辺で過ごす、もう少し長い時間。', icon: Tent }] as item (item.title)}
					<Card.Root class="shadow-none"
						><Card.Header
							><item.icon aria-hidden="true" class="mb-3 size-6 text-primary" /><Card.Title
								>{item.title}</Card.Title
							><Card.Description class="leading-7">{item.text}</Card.Description></Card.Header
						></Card.Root
					>
				{/each}
			</div>
		</section>
		<section
			class="rounded-2xl border border-border bg-card p-6 sm:p-8"
			aria-labelledby="preview-title"
		>
			<div class="max-w-xl">
				<p class="mb-2 text-xs font-semibold tracking-widest text-primary">LOCAL PREVIEW</p>
				<h2 id="preview-title" class="text-2xl font-semibold">何人で、ひと息つきますか。</h2>
				<p id="preview-help" class="mt-3 text-sm leading-7 text-muted-foreground">
					画面の動きを確認するプレビューです。入力は保存・送信されず、実際の定員や予約とは関係ありません。1〜12人でお試しください。
				</p>
				<form method="POST" use:enhance class="mt-6 flex flex-wrap items-start gap-3" novalidate>
					<fieldset disabled={!ready || $submitting} class="contents">
						<div class="w-40">
							<Label for="guests" class="mb-2">プレビュー人数</Label><Input
								id="guests"
								name="guests"
								type="number"
								min="1"
								max="12"
								step="1"
								bind:value={$form.guests}
								aria-describedby="preview-help guests-error"
								aria-invalid={$errors.guests ? true : undefined}
							/>
							<p id="guests-error" class="mt-2 text-sm text-destructive">
								{$errors.guests?.[0] ?? ''}
							</p>
						</div>
						<Button type="submit" class="mt-7" disabled={$submitting}
							>イメージする <ArrowRight aria-hidden="true" class="size-4" /></Button
						>
					</fieldset>
				</form>
				<p aria-live="polite" class="mt-4 min-h-6 text-sm">{previewMessage}</p>
			</div>
		</section>
	</main>
	<footer
		class="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t border-border px-6 py-7 text-xs text-muted-foreground sm:px-10"
	>
		<span>Sauna Studio</span><span>立ち止まる時間を、日常に。</span>
	</footer>
</div>
