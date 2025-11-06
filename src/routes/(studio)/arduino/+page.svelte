<script lang="ts">
  import VerticalComponentContainer from '../../../components/arduino-workflow-builder/VerticalComponentContainer.svelte';
  import Debug from '../../../components/arduino-workflow-builder/arduino/Debug.svelte';
  import Message from '../../../components/arduino-workflow-builder/arduino/Message.svelte';
</script>

<VerticalComponentContainer>
  <div class="slot-wrapper" slot="top">
    <Message />
  </div>
  <div class="slot-wrapper" slot="bottom">
    <Debug />
  </div>
</VerticalComponentContainer>
<svelte:head>
  <title>Arduino Workflow Builder - Arduino</title>
</svelte:head>

<style>
  .slot-wrapper {
    height: 100%;
    width: 100%;
  }
</style>
