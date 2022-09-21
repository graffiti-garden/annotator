import Logoot from '../../graffiti-x-js/logoot.js'

export default function({myID, useCollection}) { return {

  setup: ()=> {

    const fileID = Vue.ref('')

    return {
      fileID,
      characters: useCollection(()=> ({
        fileID: fileID.value,
        id: { $type: 'string' },
        timestamp: { $type: 'number' },
        $or: [{
          string: { $type: 'string' },
          ...Logoot.query('order')
        }, {
          type: 'tombstone'
        }]
      })),
      annotations: useCollection(()=> ({
        post: { $type: 'string' },
        id: { $type: 'string' },
        timestamp: { $type: 'number' },
        'inReplyTo.fileID': fileID.value,
        'inReplyTo.id': { $type: 'string' }
      }))
    }
  },

  data: ()=> ({
    selectedIds: [],
    postContent: ''
  }),

  mounted() {
    window.addEventListener('mouseup', (event) => {
      const selection = document.getSelection()
      if (!selection.anchorNode || !selection.focusNode) return

      const docRoot = document.getElementById('document')
      const anchor = selection.anchorNode.parentNode
      const focus = selection.focusNode.parentNode

      if (!anchor || !focus || !anchor.parentNode.isEqualNode(docRoot) || !focus.parentNode.isEqualNode(docRoot)) return

      this.selectedIds.length = 0
      const relativePosition = anchor.compareDocumentPosition(focus)
      if (![anchor.DOCUMENT_POSITION_PRECEDING, anchor.DOCUMENT_POSITION_FOLLOWING].includes(relativePosition)) return

      let [first, last] = (relativePosition==anchor.DOCUMENT_POSITION_PRECEDING)?
        [focus, anchor] : [anchor, focus]

      while ( !first.isEqualNode(last) ) {
        this.selectedIds.push(first.id)
        first = first.nextSibling
      }
      this.selectedIds.push(first.id)

      window.getSelection().empty();
    });
  },

  computed: {

    liveCharacters() {
      const groups = this.characters.groupBy('id')
      for (const id in groups) {
        groups[id] = groups[id].sortBy('-timestamp')
      }

      // For each ID
      return Object.keys(groups)
        // Last writer wins in each group
        .map(id=> groups[id][0])
        // Filter out any tombstones
        .filter(o=> o.type != 'tombstone')
        // Sort by logoot order
        .sort((a, b)=> Logoot.compare(a.order, b.order))
    },
  },

  methods: {
    makeAnnotation() {
      this.annotations.update({
        post: this.postContent,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        inReplyTo: {
          fileID: this.fileID,
          id: this.selectedIds
        }
      })
      this.postContent = ""
    },

    backgroundColor(id) {
      if (this.selectedIds.includes(id)) {
        return "var(--selection)"
      } else {
        const numAnnotations =
          this.annotations.filter(a=>a.inReplyTo.id.includes(id)).length
        const fraction = Math.min(numAnnotations/3.,1)
        return `rgba(190,80,120,${fraction})`
      }
    }
  },

  template: `
    <div id="document">
      <span v-for="charachter in liveCharacters" :key="charachter.id" :id="charachter.id" :style="{'background-color': backgroundColor(charachter.id)}">{{charachter.string}}</span>
    </div>

    <div id="sidebar">
      <h1>
        Annotator
      </h1>
      <p>
        Enter the document ID you want to annotate:
        <input v-model="fileID">
      </p>
      <hr>
      <p v-if="!selectedIds.length">
        Select text to view or write annotations.
      </p>
      <template v-else>
        <form @submit.prevent="makeAnnotation">
          <textarea v-model="postContent"/>
          <input type="submit" value="Post Annotation">
        </form>

        <h2>
          Annotations
        </h2>
        <ul>
          <li v-for="annotation in annotations.filter(a=>a.inReplyTo.id.some(r=> selectedIds.includes(r)))">
            {{annotation.post}}
            <menu>
              <li>
                <button @click="selectedIds=[...annotation.inReplyTo.id]">
                  Select
                </button>
              </li>
              <li>
                <button v-if="annotation._by='${myID}'" @click="annotation._remove()">
                  Remove
                </button>
              </li>
            </menu>
          </li>
        </ul>
      </template>
    </div>`
}}
