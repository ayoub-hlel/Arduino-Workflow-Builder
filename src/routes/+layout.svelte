<script lang="ts">
  import type { LayoutData } from './$types';
  
  export let data: LayoutData;
  export let form: any = null; // Add default value to prevent warning
</script>

<main>
  <slot />
</main>