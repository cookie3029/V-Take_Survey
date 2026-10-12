import { createSubscribeHandler } from '../server/subscribe.js'

export default {
  fetch: createSubscribeHandler(),
}
