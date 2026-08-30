<script lang="ts">
	import { goto } from '$app/navigation';
	import { createForm } from '@tanstack/svelte-form';
	import { z } from 'zod';

	import { authClient } from '$lib/auth-client';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Field, FieldError, FieldLabel } from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';

	let { switchToSignUp } = $props<{ switchToSignUp: () => void }>();
	let authError = $state<string | null>(null);

	const validationSchema = z.object({
		email: z.email('Invalid email address'),
		password: z.string().min(1, 'Password is required'),
	});

	const form = createForm(() => ({
		defaultValues: { email: '', password: '' },
		onSubmit: async ({ value }) => {
			authError = null;
			await authClient.signIn.email(
				{ email: value.email, password: value.password },
				{
					onSuccess: () => goto('/dashboard'),
					onError: (error) => {
						authError = error.error.message || 'Sign in failed. Please try again.';
				},
				},
			);
		},
		validators: {
			onSubmit: validationSchema,
		},
	}));

	type SubmitState = Pick<typeof form.state, 'canSubmit' | 'isSubmitting'>;
</script>

<div class="mx-auto mt-10 w-full max-w-md px-4 pb-10">
	<form
		onsubmit={(event) => {
			event.preventDefault();
			event.stopPropagation();
			form.handleSubmit();
		}}
	>
		<Card>
			<CardHeader>
				<CardTitle>Welcome back</CardTitle>
				<CardDescription>Sign in to manage your Nymveil identities.</CardDescription>
			</CardHeader>

			<CardContent class="grid gap-4">
				{#if authError}
					<Alert variant="destructive">
						<AlertTitle>Unable to sign in</AlertTitle>
						<AlertDescription>{authError}</AlertDescription>
					</Alert>
				{/if}

				<form.Field name="email">
					{#snippet children(field)}
						<Field>
							<FieldLabel for={field.name}>Email</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								value={field.state.value}
								onblur={field.handleBlur}
								oninput={(event) => field.handleChange(event.currentTarget.value)}
								aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
							/>
							{#if field.state.meta.isTouched && field.state.meta.errors.length > 0}
								<FieldError>
									{#each field.state.meta.errors as error}
										<span>{error}</span>
									{/each}
								</FieldError>
							{/if}
						</Field>
					{/snippet}
				</form.Field>

				<form.Field name="password">
					{#snippet children(field)}
						<Field>
							<FieldLabel for={field.name}>Password</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								onblur={field.handleBlur}
								oninput={(event) => field.handleChange(event.currentTarget.value)}
								aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
							/>
							{#if field.state.meta.isTouched && field.state.meta.errors.length > 0}
								<FieldError>
									{#each field.state.meta.errors as error}
										<span>{error}</span>
									{/each}
								</FieldError>
							{/if}
						</Field>
					{/snippet}
				</form.Field>
			</CardContent>

			<CardFooter class="grid gap-3">
				<form.Subscribe
					selector={(state: typeof form.state): SubmitState => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{#snippet children(state: SubmitState)}
						<Button type="submit" class="w-full" disabled={!state.canSubmit || state.isSubmitting}>
							{state.isSubmitting ? 'Signing in...' : 'Sign in'}
						</Button>
					{/snippet}
				</form.Subscribe>

				<Button type="button" variant="link" class="h-auto" onclick={switchToSignUp}>
					Need an account? Sign up
				</Button>
			</CardFooter>
		</Card>
	</form>
</div>
