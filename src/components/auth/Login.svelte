

<script lang="ts">
    import { goto } from '$app/navigation';
    import { onErrorMessage } from '../../help/alerts';
    import { loginGoogleUser } from '../../auth/clerk-auth';
    
    /**
     * Handle Google login with Clerk
     */
    async function googleLogin() {
        try {
            await loginGoogleUser();
            await goto("/");
        } catch(e) {
            console.error('Login error:', e);
            // Handle specific Clerk error codes when implemented
            if (e?.code === "clerk/cancelled-popup-request") {
                return;
            }
            onErrorMessage("Sorry, please try again in 5 minutes. :)", e);
        }
    }
    
</script>

<style>
    .login-button {
        display: block;
        margin: auto;
        width: 200px;
        margin-top: 20px;
        border: none;
        background: none;
        cursor: pointer;
        padding: 0;
    }
    
    .login-button img {
        width: 100%;
        height: auto;
    }
    
    .login-button:hover {
        opacity: 0.8;
    }
    
    .login-button:focus {
        outline: 2px solid #4285f4;
        outline-offset: 2px;
    }
</style>

<button class="login-button" on:click={googleLogin} type="button" aria-label="Sign in with Google">
    <img src="/signin-btn.png" alt="Sign in with Google" />
</button>
