<script lang="ts">
  import VerticalComponentContainer from '../../components/arduino-workflow-builder/VerticalComponentContainer.svelte';
  import Simulator from '../../components/arduino-workflow-builder/home/Simulator.svelte';
  import Step from '../../components/arduino-workflow-builder/home/Steps.svelte';
</script>

<VerticalComponentContainer>
  <div class="slot-wrapper" slot="top">
    <Simulator />
  </div>
  <div class="slot-wrapper" slot="bottom">
    <Step />
  </div>
</VerticalComponentContainer>
<svelte:head>
  <title>Arduino Workflow Builder</title>
</svelte:head>

<style>
  .slot-wrapper {
    height: 100%;
    width: 100%;
  }
</style>
