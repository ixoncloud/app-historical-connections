<script lang="ts">
  import type { ComponentContext } from '@ixon-cdk/types';

  let { context }: { context: ComponentContext } = $props();
</script>

<main>
  <h1>This works!</h1>
</main>

<style lang="scss">
  $heading-color: #ff3e00;

  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }
  h1 {
    color: $heading-color;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }
  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
