EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/screen-time@chalmery

.PHONY: all schema translations install clean

all: schema translations

schema:
	glib-compile-schemas schemas/

translations:
	msgfmt po/zh_CN.po -o locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo
	msgfmt po/en.po -o locale/en/LC_MESSAGES/screen-time@chalmery.mo

install:
	mkdir -p $(EXT_DIR)
	cp -r extension.js metadata.json panelIndicator.js popupWidget.js \
	      usageStore.js usageTracker.js prefs.js schemas/ locale/ $(EXT_DIR)/

clean:
	rm -f schemas/gschema.compiled
	rm -f locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo
	rm -f locale/en/LC_MESSAGES/screen-time@chalmery.mo
