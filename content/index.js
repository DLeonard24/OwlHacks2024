var jcrop, selection;

var overlay = ((active) => (state) => {
  active = typeof state === 'boolean' ? state : state === null ? active : !active;
  $('.jcrop-holder')[active ? 'show' : 'hide']();
  chrome.runtime.sendMessage({message: 'active', active});
})(false);

var image = (done) => {
  var image = new Image();
  image.id = 'fake-image';
  image.src = chrome.runtime.getURL('/content/pixel.png');
  image.onload = () => {
    $('body').append(image);
    done();
  };
};

var init = (done) => {
  $('#fake-image').Jcrop({
    bgColor: 'none',
    onSelect: (e) => {
      selection = e;
      capture();
    },
    onChange: (e) => {
      selection = e;
    },
    onRelease: (e) => {
      setTimeout(() => {
        selection = null;
      }, 100);
    }
  }, function ready() {
    jcrop = this;

    $('.jcrop-hline, .jcrop-vline').css({
      backgroundImage: `url(${chrome.runtime.getURL('/vendor/Jcrop.gif')})`
    });

    if (selection) {
      jcrop.setSelect([
        selection.x, selection.y,
        selection.x2, selection.y2
      ]);
    }

    done && done();
  });
};

var capture = (force) => {
  chrome.storage.sync.get((config) => {
    if (selection && (config.method === 'crop' || (config.method === 'wait' && force))) {
      jcrop.release();
      setTimeout(async () => {  // Use async here
        var _selection = selection;
        chrome.runtime.sendMessage({
          message: 'capture', format: config.format, quality: config.quality
        }, async (res) => {  // Await for response
          overlay(false);
          const area = {}; // Define area based on your requirements
          crop(res.image, area, devicePixelRatio, config.scaling, config.format, async (image) => {
            const result = await query_gemini(image);  // Await query_gemini here
            displayImage(image, result);               // Pass the result to displayImage
          });
        });
      }, 50);
    } else if (config.method === 'view') {
      chrome.runtime.sendMessage({
        message: 'capture', format: config.format, quality: config.quality
      }, async (res) => {  // Await for response
        overlay(false);
        if (devicePixelRatio !== 1 && !config.scaling) {
          var area = {x: 0, y: 0, w: innerWidth, h: innerHeight};
          crop(res.image, area, devicePixelRatio, config.scaling, config.format, async (image) => {
            const result = await query_gemini(image);  // Await query_gemini here
            displayImage(image, result);               // Pass the result to displayImage
          });
        } else {
          displayImage(res.image);  // Changed from save() to displayImage()
        }
      });
    }
  });
};

var save = (image, format, save, clipboard, dialog) => {
  if (save.includes('file')) {
    var link = document.createElement('a')
    link.download = filename(format)
    link.href = image
    link.click()
  }
  if (save.includes('clipboard')) {
    if (clipboard === 'url') {
      navigator.clipboard.writeText(image).then(() => {
        if (dialog) {
          alert([
            'Screenshot Capture:',
            'Data URL String',
            'Saved to Clipboard!'
          ].join('\n'))
        }
      })
    }
    else if (clipboard === 'binary') {
      var [header, base64] = image.split(',')
      var [_, type] = /data:(.*);base64/.exec(header)
      var binary = atob(base64)
      var array = Array.from({length: binary.length})
        .map((_, index) => binary.charCodeAt(index))
      navigator.clipboard.write([
        new ClipboardItem({
          // jpeg is not supported on write, though the encoding is preserved
          'image/png': new Blob([new Uint8Array(array)], {type: 'image/png'})
        })
      ]).then(() => {
        if (dialog) {
          alert([
            'Screenshot Capture:',
            'Binary Image',
            'Saved to Clipboard!'
          ].join('\n'))
        }
      })
    }
  }
}


var displayImage = (imageData, res) => {

  var popup = document.createElement('div');
  popup.id = 'image-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.backgroundColor = 'white';
  popup.style.border = '2px solid black';
  popup.style.padding = '20px';
  popup.style.zIndex = '1000';

  popup.innerHTML = `
    <img src="${imageData}" alt="Captured Image" style="max-width:100%;"><br>
    <span style="font-size: 20px;">${res ? res[0].text : 'No text found'}</span><br>
    <button id="close-popup" style="margin-top: 10px;">Close</button>
  `;

  document.body.appendChild(popup);

  document.querySelector('#close-popup').addEventListener('click', () => {
    popup.remove();
  });
};

window.addEventListener('resize', ((timeout) => () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    jcrop.destroy();
    init(() => overlay(null));
  }, 100);
})());

chrome.runtime.onMessage.addListener((req, sender, res) => {
  console.log("Received message:", req);

  if (req.message === 'init') {
    res({}); // Send a response to prevent re-injecting

    if (!jcrop) {
      console.log("Initializing image...");
      image(() => {
        init(() => {
          overlay();
          capture();
        });
      });
    } else {
      overlay();
      capture(true);
    }
  }
  return true;  // Keep the message channel open for async response
});