/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">¡Comencemos la discusión!</a> Hay ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> tema";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> temas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " y ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicación";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicaciones";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Los visitantes necesitan más contenido para leer y responder – nosotros recomendamos al menos ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> tema";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> temas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " y ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicación";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicaciones";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Solo los miembros del staff pueden ver este mensaje.";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">¡Comencemos la discusión!</a> Hay ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> tema";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> temas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Los visitantes necesitan más contenido para leer y responder – nosotros recomendamos al menos ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> tema";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> temas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Solo los miembros del staff pueden ver este mensaje.";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">¡Comencemos la discusión!</a> Hay ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicación";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicaciones";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Los visitantes necesitan más contenido para leer y responder – nosotros recomendamos al menos ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicación";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> publicaciones";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Solo los miembros del staff pueden ver este mensaje.";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> alcanzó el límite de la configuración del sitio de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> alcanzó el límite de la configuración del sitio de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> excedió el límite de la configuración del sitio del ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> excedió el límite de la configuración del sitio de ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "Hay ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 no leído</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " no leídos</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "y ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 nuevo</a> tema";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "y ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nuevos</a> temas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restantes, o ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "explora otros temas en ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "topic.bumped_at_title_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["FIRST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["CREATED_AT"];
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LAST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["BUMPED_AT"];
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Estás a punto de eliminar ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> post";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " y ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> topic";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " de este usuario, eliminar su cuenta, bloquear registros desde su dirección IP <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b>, y añadir su dirección de correo electrónico <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> a la lista de bloqueo permanente. ¿Estás seguro de que este usuario es un spammer?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Este tema tiene ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 respuesta";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " respuestas";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "con una proporción de me gusta por publicación elevada";
return r;
},
"med" : function(d){
var r = "";
r += "con una proporción de me gusta por publicación bastante elevada";
return r;
},
"high" : function(d){
var r = "";
r += "con una proporción de me gusta por publicación elevadísima";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "Estás a punto de eliminar ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 post";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " posts";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " y ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 topic";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["es"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". ¿Estás seguro?";
return r;
}};
MessageFormat.locale.es = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"es":{"js":{"number":{"format":{"separator":",","delimiter":"."},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year":"D MMM, HH:mm","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"D MMM YYYY HH:mm","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"D MMMM YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"D MMM LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eLT","wrap_ago":"hace %{date}","tiny":{"half_a_minute":"\u003c 1 m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count} s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m","other":"\u003c %{count} min"},"x_minutes":{"one":"%{count}m","other":"%{count} min"},"about_x_hours":{"one":"%{count}h","other":"%{count} h"},"x_days":{"one":"%{count}d","other":"%{count} d"},"x_months":{"one":"%{count} mes","other":"%{count} meses"},"about_x_years":{"one":"%{count}a","other":"%{count} a"},"over_x_years":{"one":"\u003e %{count}a","other":"\u003e %{count} a"},"almost_x_years":{"one":"%{count}a","other":"%{count} a"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} minuto","other":"%{count} min"},"x_hours":{"one":"%{count} hora","other":"%{count} horas"},"x_days":{"one":"%{count} día","other":"%{count} días"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"hace %{count} minuto","other":"hace %{count} minutos"},"x_hours":{"one":"hace %{count} hora","other":"hace %{count} horas"},"x_days":{"one":"hace %{count} día","other":"hace %{count} días"},"x_months":{"one":"hace %{count} mes","other":"hace %{count} meses"},"x_years":{"one":"hace %{count} año","other":"hace %{count} años"}},"later":{"x_days":{"one":"%{count} día después","other":"%{count} días después"},"x_months":{"one":"%{count} mes después","other":"%{count} meses después"},"x_years":{"one":"%{count} año después","other":"%{count} años después"}},"previous_month":"Mes anterior","next_month":"Mes siguiente","placeholder":"fecha"},"share":{"topic_html":"Tema: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"publicación #%{postNumber}","close":"cerrar","twitter":"Comparte este enlace en Twitter","facebook":"Comparte este enlace en Facebook","email":"Envía este enlace por correo electrónico"},"action_codes":{"public_topic":"hizo este tema público %{when}","private_topic":"hizo este tema un mensaje personal %{when}","split_topic":"separó este tema %{when}","invited_user":"invitó a %{who} %{when}","invited_group":"invitó a %{who} %{when}","user_left":"%{who} se eliminó a sí mismo de este mensaje %{when}","removed_user":"eliminó a %{who} %{when}","removed_group":"eliminó a %{who} %{when}","autobumped":"bumped automáticamente %{when}","autoclosed":{"enabled":"cerrado %{when}","disabled":"abierto %{when}"},"closed":{"enabled":"cerrado %{when}","disabled":"abierto %{when}"},"archived":{"enabled":"archivado %{when}","disabled":"desarchivado %{when}"},"pinned":{"enabled":"destacado %{when}","disabled":"sin destacar %{when}"},"pinned_globally":{"enabled":"destacado globalmente %{when}","disabled":"sin destacar %{when}"},"visible":{"enabled":"listado %{when}","disabled":"quitado de la lista %{when}"},"banner":{"enabled":"hizo esto un encabezado %{when}. Aparecerá en la parte superior de cada página hasta que el usuario lo descarte.","disabled":"eliminó este encabezado %{when}. Ya no aparecerá en la parte superior de cada página."},"forwarded":"reenvió el correo electrónico de arriba"},"topic_admin_menu":"acciones del tema","wizard_required":"¡Bienvenido a tu nuevo Discourse! Empezaremos con \u003ca href='%{url}' data-auto-route='true'\u003eel asistente de configuración\u003c/a\u003e ✨","emails_are_disabled":"Todos los correos electrónicos salientes han sido deshabilitados globalmente por un administrador. No se enviarán notificaciones por correo electrónico de ningún tipo.","bootstrap_mode_enabled":"Para facilitar el lanzamiento de tu nuevo sitio, estás en modo de arranque. A todos los usuarios nuevos se les otorgará el nivel de confianza 1 y se tendrán habilitados los correos electrónicos de resumen diarios. Esta función se desactivará automáticamente cuando %{min_users} usuarios se hayan unido.","bootstrap_mode_disabled":"El modo de arranque se desactivará dentro de las próximas 24 horas.","themes":{"default_description":"Por defecto","broken_theme_alert":"Tu sitio puede no funcionar porque el tema / componente %{theme} tiene errores. Desactívalo en %{path}."},"s3":{"regions":{"ap_northeast_1":"Asia-Pacífico (Tokio)","ap_northeast_2":"Asia-Pacífico (Seúl)","ap_south_1":"Asia Pacific (Mumbai)","ap_southeast_1":"Asia-Pacífico (Singapur)","ap_southeast_2":"Asia-Pacífico (Sydney)","ca_central_1":"Canadá (Central)","cn_north_1":"China (Beijing)","cn_northwest_1":"China (Ningxia)","eu_central_1":"EU (Frankfurt)","eu_north_1":"EU (Estocolmo)","eu_west_1":"EU (Irlanda)","eu_west_2":"EU (Londres)","eu_west_3":"EU (París)","sa_east_1":"Sudamérica (São Paulo)","us_east_1":"EEUU este (norte de Virginia)","us_east_2":"EEUU este (Ohio)","us_gov_east_1":"AWS GovCloud (EEUU-este)","us_gov_west_1":"AWS GovCloud (EEUU-oeste)","us_west_1":"EEUU oeste (norte de California)","us_west_2":"EEUU oeste (Oregon)"}},"edit":"editar el título y la categoría de este tema","expand":"Expandir","not_implemented":"¡Lo sentimos! Esa característica no se ha implementado todavía.","no_value":"No","yes_value":"Sí","submit":"Enviar","generic_error":"Lo sentimos, ha ocurrido un error.","generic_error_with_reason":"Ocurrió un error: %{error}","go_ahead":"Adelante","sign_up":"Registrarse","log_in":"Iniciar sesión","age":"Edad","joined":"Registrado","admin_title":"Admin","show_more":"mostrar más","show_help":"opciones","links":"Enlaces","links_lowercase":{"one":"enlace","other":"enlaces"},"faq":"Preguntas frecuentes","guidelines":"Guía","privacy_policy":"Política de privacidad","privacy":"Política de privacidad","tos":"Términos de servicio","rules":"Reglas","conduct":"Código de conducta","mobile_view":"Versión móvil","desktop_view":"Versión de escritorio","you":"Tú","or":"o","now":"justo ahora","read_more":"leer más","more":"Más","less":"Menos","never":"nunca","every_30_minutes":"cada 30 minutos","every_hour":"cada hora","daily":"diario","weekly":"semanalmente","every_month":"cada mes","every_six_months":"cada seis meses","max_of_count":"máximo de {{count}}","alternation":"o","character_count":{"one":"{{count}} carácter","other":"{{count}} caracteres"},"related_messages":{"title":" Mensajes relacionados","see_all":"Ver \u003ca href=\"%{path}\"\u003etodos los mensajes\u003c/a\u003e de @%{username}..."},"suggested_topics":{"title":"Temas sugeridos","pm_title":"Mensajes sugeridos"},"about":{"simple_title":"Acerca de","title":"Sobre %{title}","stats":"Estadísticas del sitio","our_admins":"Nuestros administradores","our_moderators":"Nuestros moderadores","moderators":"Moderadores","stat":{"all_time":"Todo el tiempo","last_7_days":"Últimos 7","last_30_days":"Últimos 30"},"like_count":"Me gusta","topic_count":"Temas","post_count":"Publicaciones","user_count":"Usuarios","active_user_count":"Usuarios activos","contact":"Contáctanos","contact_info":"En caso de un problema crítico o urgente que esté afectando este sitio, contáctanos a través de %{contact_info}."},"bookmarked":{"title":"Marcador","clear_bookmarks":"Quitar marcadores","help":{"bookmark":"Haz clic para marcar la primera publicación sobre este tema","unbookmark":"Haz clic para eliminar todos los marcadores en este tema","unbookmark_with_reminder":"Haz clic para quitar todos los marcadores y recordatorios en este tema. Tienes un recordatorio puesto %{reminder_at} para este tema."}},"bookmarks":{"created":"has marcado esta publicación","not_bookmarked":"marcar esta publicación","created_with_reminder":"has guardado esta publicación en marcadores con un recordatorio %{date}","created_with_at_desktop_reminder":"guardaste esta publicación en marcadores y se te recordará la próxima vez que estés en tu computadora","remove":"Eliminar marcador","delete":"Borrar marcador","confirm_delete":"¿Seguro que quieres borrar este marcados? El recordatorio también se borrará.","confirm_clear":"¿Estás seguro de que deseas eliminar todos tus marcadores en este tema?","save":"Guardar","no_timezone":"No has establecido una zona horaria todavía. No podrás establecer recordatorios. Puedes elegir una \u003ca href=\"%{basePath}/my/preferences/profile\"\u003een tu perfil\u003c/a\u003e.","invalid_custom_datetime":"La fecha y hora que suministraste es inválida. Por favor, intenta de nuevo.","list_permission_denied":"No tienes permiso para ver los marcadores de este usuario.","reminders":{"at_desktop":"La próxima vez que esté en mi ordenador","later_today":"Más tarde durante el día de hoy","next_business_day":"Siguiente día hábil","tomorrow":"Mañana","next_week":"Próxima semana","later_this_week":"Esta misma semana","start_of_next_business_week":"Lunes que viene","next_month":"Próximo mes","custom":"Fecha y hora personalizadas","last_custom":"Último","none":"No se necesita recordatorio","today_with_time":"hoy a las %{time}","tomorrow_with_time":"mañana a las %{time}","at_time":"a las %{date_time}","existing_reminder":"Tienes un recordatorio puesto para este marcador que será enviado"}},"drafts":{"resume":"Reanudar","remove":"Eliminar","new_topic":"Nuevo borrador de tema","new_private_message":"Nuevo borrador de mensaje privado","topic_reply":"Borrador de respuesta","abandon":{"confirm":"Ya has abierto otro borrador en este tema. ¿Estás seguro de que quieres abandonarlo?","yes_value":"Sí, abandonar","no_value":"No, mantener"}},"topic_count_latest":{"one":"Ver {{count}} tema nuevo o actualizado","other":"Ver {{count}} temas nuevos o actualizados"},"topic_count_unread":{"one":"Ver {{count}} tema sin leer","other":"Ver {{count}} temas no leídos"},"topic_count_new":{"one":"Ver {{count}} tema nuevo","other":"Ver {{count}} temas nuevos"},"preview":"vista previa","cancel":"cancelar","save":"Guardar cambios","saving":"Guardando...","saved":"¡Guardado!","upload":"Subir","uploading":"Subiendo...","uploading_filename":"Subiendo: {{filename}}...","clipboard":"portapapeles","uploaded":"¡Subido!","pasting":"Pegando...","enable":"Activar","disable":"Desactivar","continue":"Continuar","undo":"Deshacer","revert":"Revertir","failed":"Falló","switch_to_anon":"Entrar en modo anónimo","switch_from_anon":"Salir del modo anónimo","banner":{"close":"Descartar este encabezado.","edit":"Editar este encabezado \u003e\u003e"},"pwa":{"install_banner":"¿Quieres \u003ca href\u003einstalar %{title} en este dispositivo?\u003c/a\u003e"},"choose_topic":{"none_found":"No se encontraron temas.","title":{"search":"Busca un tema","placeholder":"escribe el título, url o ID del tema aquí"}},"choose_message":{"none_found":"No se encontraron mensajes.","title":{"search":"Busca un mensaje","placeholder":"escribe el título, url o ID del mensaje aquí"}},"review":{"order_by":"Ordenar por","in_reply_to":"en respuesta a","explain":{"why":"explica por qué ha acabado en la cola","title":"Puntuación de revisable","formula":"Fórmula","subtotal":"Subtotal","total":"Total","min_score_visibility":"Puntuación mínima para ser visible","score_to_hide":"Puntuación mínima para ocultar publicación","take_action_bonus":{"name":"acción tomada","title":"Cuando un miembro del staff decide tomar acciones, se le otorga un bono al reporte."},"user_accuracy_bonus":{"name":"precisión del usuario","title":"Los usuarios con los que se ha coincidido en reportes anteriores reciben puntos extra."},"trust_level_bonus":{"name":"nivel de confianza","title":"Los revisables creados por usuarios con niveles de confianza elevados reciben una puntuación más alta."},"type_bonus":{"name":"tipo de bonificación","title":"Algunos tipos de revisables pueden recibir una bonificación por el staff para que tengan mayor prioridad."}},"claim_help":{"optional":"Puedes reclamar este artículo para evitar que otros lo revisen.","required":"Debes reclamar los artículos antes de poder revisarlos.","claimed_by_you":"Has reclamado este artículo y puedes revisarlo.","claimed_by_other":"Este artículo solo puede ser revisado por \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"reclamar este tema"},"unclaim":{"help":"eliminar esta reclamación"},"awaiting_approval":"Esperando aprobación","delete":"Eliminar","settings":{"saved":"Guardado","save_changes":"Guardar cambios","title":"Ajustes","priorities":{"title":"Prioridades revisables"}},"moderation_history":"Historial de moderación","view_all":"Ver todo","grouped_by_topic":"Agrupado por tema","none":"No hay artículos para revisar.","view_pending":"ver pendiente","topic_has_pending":{"one":"Este tema tiene \u003cb\u003e%{count}\u003c/b\u003e publicación esperando aprobación","other":"Este tema tiene \u003cb\u003e{{count}}\u003c/b\u003e publicaciones pendientes de aprobación"},"title":"Revisión","topic":"Tema:","filtered_topic":"Has filtrado a contenido revisable en un solo tema.","filtered_user":"Usuario","show_all_topics":"mostrar todos los temas","deleted_post":"(publicación eliminada)","deleted_user":"(usuario eliminado)","user":{"bio":"Biografía","website":"Página web","username":"Nombre de usuario","email":"Correo electrónico","name":"Nombre","fields":"Campos"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}}, ({{count}} reporte en total)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} reportes totales)"},"agreed":{"one":"{{count}}% de acuerdo","other":"{{count}}% de acuerdo"},"disagreed":{"one":"{{count}}% en desacuerdo","other":"{{count}}% en desacuerdo"},"ignored":{"one":"{{count}}% ignorado","other":"{{count}}% ignorados"}},"topics":{"topic":"Tema","reviewable_count":"Cantidad","reported_by":"Reportado por","deleted":"[Tema eliminado]","original":"(tema original)","details":"detalles","unique_users":{"one":"%{count} usuario","other":"{{count}} usuarios"}},"replies":{"one":"%{count} respuest","other":"{{count}} respuestas"},"edit":"Editar","save":"Guardar","cancel":"Cancelar","new_topic":"Aprobar este elemento creará un tema nuevo","filters":{"all_categories":"(todas las categorías)","type":{"title":"Tipo","all":"(todos los tipos)"},"minimum_score":"Puntuación mínima:","refresh":"Actualizar","status":"Estado","category":"Categoría","orders":{"priority":"Prioridad","priority_asc":"Prioridad (inverso)","created_at":"Creado el","created_at_asc":"Creado el (inverso)"},"priority":{"title":"Prioridad mínima","low":"(cualquiera)","medium":"Media","high":"Alta"}},"conversation":{"view_full":"ver conversación completa"},"scores":{"about":"Esta puntuación se calcula en función del nivel de confianza de quien lo reporta, la precisión de sus reportes anteriores y la prioridad del elemento que se reporta.","score":"Puntuación","date":"Fecha","type":"Tipo","status":"Estado","submitted_by":"Enviado por","reviewed_by":"Revisado por"},"statuses":{"pending":{"title":"Pendiente"},"approved":{"title":"Aprobado"},"rejected":{"title":"Rechazado"},"ignored":{"title":"Ignorado"},"deleted":{"title":"Eliminado"},"reviewed":{"title":"(todo revisado)"},"all":{"title":"(todo)"}},"types":{"reviewable_flagged_post":{"title":"Publicación reportada","flagged_by":"Reportado por"},"reviewable_queued_topic":{"title":"Tema en cola"},"reviewable_queued_post":{"title":"Publicación en cola"},"reviewable_user":{"title":"Usuario"}},"approval":{"title":"La publicación requiere aprobación","description":"Hemos recibido tu nueva publicación, pero debe ser aprobada por un moderador antes de que aparezca. Por favor, sé paciente.","pending_posts":{"one":"Tienes \u003cstrong\u003e%{count}\u003c/strong\u003e publicación pendiente.","other":"Tienes \u003cstrong\u003e{{count}}\u003c/strong\u003e publicaciones pendientes."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e publicó \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e publicaste \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondió a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e respondiste a \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e respondió a \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eTú\u003c/a\u003e respondiste a \u003ca href='{{topicUrl}}'\u003eel tema\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mencionó a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003ete mencionó\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eTú\u003c/a\u003e mencionaste a \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Publicado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Publicado por \u003ca href='{{userUrl}}'\u003eti\u003c/a\u003e","sent_by_user":"Enviado por \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Enviado por \u003ca href='{{userUrl}}'\u003eti\u003c/a\u003e"},"directory":{"filter_name":"filtrar por nombre de usuario","title":"Usuarios","likes_given":"Dados","likes_received":"Recibidos","topics_entered":"Vistos","topics_entered_long":"Temas vistos","time_read":"Tiempo leído","topic_count":"Temas","topic_count_long":"Temas creados","post_count":"Respuestas","post_count_long":"Respuestas publicadas","no_results":"No se encontraron resultados.","days_visited":"Visitas","days_visited_long":"Días visitados","posts_read":"Leídos","posts_read_long":"Publicaciones leídas","last_updated":"Última actialización:","total_rows":{"one":"%{count} usuario","other":"%{count} usuarios"}},"group_histories":{"actions":{"change_group_setting":"Cambiar configuración de grupo","add_user_to_group":"Añadir usuario","remove_user_from_group":"Eliminar usuario","make_user_group_owner":"Hacer propietario","remove_user_as_group_owner":"Revocar propietario"}},"groups":{"member_added":"Añadido","member_requested":"Solicitado el","add_members":{"title":"Añadir miembros","description":"Administrar la membresía de este grupo","usernames":"Nombres de usuario"},"requests":{"title":"Solicitudes","reason":"Motivo","accept":"Aceptar","accepted":"aceptado","deny":"Denegar","denied":"denegado","undone":"solicitud deshecha","handle":"atender solicitud de membresía"},"manage":{"title":"Gestionar","name":"Nombre","full_name":"Nombre completo","add_members":"Añadir miembros","delete_member_confirm":"¿Eliminar a «%{username}» del grupo «%{group}»?","profile":{"title":"Perfil"},"interaction":{"title":"Interacción","posting":"Publicando","notification":"Notificación"},"membership":{"title":"Membresía","access":"Acceso"},"logs":{"title":"Registros","when":"Cuándo","action":"Acción","acting_user":"Usuario accionante","target_user":"Usuario objetivo","subject":"Tema","details":"Detalles","from":"Desde","to":"Hasta"}},"public_admission":"Permitir que los usuarios se unan al grupo libremente (Se requiere que el grupo sea publicamente visible)","public_exit":"Permitir a los usuarios abandonar el grupo libremente","empty":{"posts":"No hay publicaciones por miembros de este grupo.","members":"No hay miembros en este grupo.","requests":"No hay solicitudes de membresía para este grupo.","mentions":"No hay menciones de este grupo.","messages":"No hay mensajes para este grupo.","topics":"No hay temas por miembros de este grupo.","logs":"No hay registros para este grupo."},"add":"Añadir","join":"Unirse","leave":"Abandonar","request":"Solicitar","message":"Mensaje","confirm_leave":"¿Estás seguro de que quieres salir de este grupo?","allow_membership_requests":"Permitir a los usuarios enviar solicitudes de membresía a dueños de grupo (el grupo tiene que ser públicamente visible)","membership_request_template":"Plantilla personalizada que se muestra a los usuarios cuando envían una solicitud de membresía","membership_request":{"submit":"Enviar solicitud","title":"Solicitar unirse a @%{group_name}","reason":"Hazles saber a los propietarios del grupo por qué perteneces a este grupo"},"membership":"Membresía","name":"Nombre","group_name":"Nombre del grupo","user_count":"Usuarios","bio":"Acerca del grupo","selector_placeholder":"Ingresa tu nombre de usuario","owner":"propietario","index":{"title":"Grupos","all":"Todos los grupos","empty":"No hay grupos visibles.","filter":"Filtrar por tipo de grupo","owner_groups":"Grupos de los que soy propietario","close_groups":"Grupos cerrados","automatic_groups":"Grupos automáticos","automatic":"Automático","closed":"Cerrado","public":"Público","private":"Privado","public_groups":"Grupos públicos","automatic_group":"Grupo automático","close_group":"Cerrar grupo","my_groups":"Mis grupos","group_type":"Tipo de grupo","is_group_user":"Miembro","is_group_owner":"Propietario"},"title":{"one":"Grupo","other":"Grupos"},"activity":"Actividad","members":{"title":"Miembros","filter_placeholder_admin":"nombre de usuario o correo electrónico","filter_placeholder":"nombre de usuario","remove_member":"Eliminar miembro","remove_member_description":"Eliminar \u003cb\u003e%{username}\u003c/b\u003e de este grupo","make_owner":"Hacer propietario","make_owner_description":"Hacer a \u003cb\u003e%{username}\u003c/b\u003e un propietario de este grupo","remove_owner":"Eliminar como propietario","remove_owner_description":"Eliminar a \u003cb\u003e%{username}\u003c/b\u003e como propietario de este grupo","owner":"Propietario","forbidden":"No tienes permitido ver los miembros."},"topics":"Temas","posts":"Publicaciones","mentions":"Menciones","messages":"Mensajes","notification_level":"Nivel de notificación predeterminado para mensajes de grupo","alias_levels":{"mentionable":"¿Quién puede @mencionar este grupo?","messageable":"¿Quién puede enviar mensajes a este grupo?","nobody":"Nadie","only_admins":"Solo administradores","mods_and_admins":"Solo moderadores y administradores","members_mods_and_admins":"Solo miembros del grupo, moderadores y administradores","owners_mods_and_admins":"Solo propietarios del grupo, moderadores y administradores","everyone":"Todos"},"notifications":{"watching":{"title":"Vigilando","description":"Se te notificará cada nueva publicación en cada mensaje y se mostrará un recuento de las respuestas nuevas."},"watching_first_post":{"title":"Vigilando la primera publicación","description":"Se te notificarán los mensajes nuevos en este grupo, pero no las respuestas a los mensajes."},"tracking":{"title":"Siguiendo","description":"Se te notificará si alguien menciona tu @nombre o te responde y se mostrará un recuento de las respuestas nuevas."},"regular":{"title":"Normal","description":"Se te notificará si alguien menciona tu @nombre o te responde."},"muted":{"title":"Silenciado","description":"No se te notificará nada sobre los mensajes en este grupo."}},"flair_url":"Imagen del sub-avatar","flair_url_placeholder":"(Opcional) URL de imagen o clase de Font Awesome","flair_url_description":"Usa imágenes cuadradas de no menos de 20 px por 20 px o los iconos de FontAwesome (formatos aceptados: «fa-icon», «far fa-icon» o «fab fa-icon»).","flair_bg_color":"Color de fondo del sub-avatar","flair_bg_color_placeholder":"(Opcional) Valor de color hexadecimal","flair_color":"Color del sub-avatar","flair_color_placeholder":"(Opcional) Valor de color hexadecimal","flair_preview_icon":"Previsualización del icono","flair_preview_image":"Previsualización de la imagen"},"user_action_groups":{"1":"Me gusta dados","2":"Me gusta recibidos","3":"Marcadores","4":"Temas","5":"Respuestas","6":"Reacciones","7":"Menciones","9":"Citas","11":"Ediciones","12":"Elementos enviados","13":"Bandeja de entrada","14":"Pendiente","15":"Borradores"},"categories":{"all":"todas las categorías","all_subcategories":"todas","no_subcategory":"ninguna","category":"Categoría","category_list":"Mostrar lista de categorías","reorder":{"title":"Reordenar las categorías","title_long":"Reorganizar la lista de categorías","save":"Guardar orden","apply_all":"Aplicar","position":"Posición"},"posts":"Publicaciones","topics":"Temas","latest":"Recientes","latest_by":"recientes por","toggle_ordering":"cambiar orden","subcategories":"Subcategorías","topic_sentence":{"one":"%{count} tema","other":"%{count} temas"},"topic_stat_sentence_week":{"one":"%{count} nuevo tema en la última semana.","other":"%{count} temas nuevos en la última semana."},"topic_stat_sentence_month":{"one":"%{count} nuevo tema en el último mes.","other":"%{count} temas nuevos en el último mes."},"n_more":"Categorías (%{count} más) ..."},"ip_lookup":{"title":"Búsqueda de dirección IP","hostname":"Nombre del host","location":"Ubicación","location_not_found":"(desconocido)","organisation":"Organización","phone":"Teléfono","other_accounts":"Otras cuentas con esta dirección IP:","delete_other_accounts":"Eliminar %{count}","username":"usuario","trust_level":"NC","read_time":"tiempo de lectura","topics_entered":"temas ingresados","post_count":"# posts","confirm_delete_other_accounts":"¿Estás seguro de que quieres eliminar estas cuentas?","powered_by":"usando \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copiado"},"user_fields":{"none":"(selecciona una opción)"},"user":{"said":"{{username}}:","profile":"Perfil","mute":"Silenciar","edit":"Editar Preferencias","download_archive":{"button_text":"Descargar todos","confirm":"¿Seguro de que quieres descargar tus publicaciones?","success":"Descarga iniciada, se te notificará por mensaje cuando el proceso se haya completado.","rate_limit_error":"Solo se pueden descargar las publicaciones una vez al día. Por favor, inténtalo de nuevo mañana."},"new_private_message":"Mensaje nuevo","private_message":"Mensaje","private_messages":"Mensajes","user_notifications":{"ignore_duration_title":"Temporizador de ignorado","ignore_duration_username":"Nombre de usuario","ignore_duration_when":"Duración:","ignore_duration_save":"Ignorar","ignore_duration_note":"Por favor, ten en cuenta que todos los ignorados se eliminan automáticamente al expirar la duración especificada para esta acción.","ignore_duration_time_frame_required":"Por favor, selecciona un intervalo de tiempo","ignore_no_users":"No ignoras a ningún usuario","ignore_option":"Ignorado","ignore_option_title":"No recibirás notificaciones relacionadas con este usuario y todos sus temas y respuestas se ocultarán.","add_ignored_user":"Añadir...","mute_option":"Silenciado","mute_option_title":"No recibirás ninguna notificación relacionada con este usuario.","normal_option":"Normal","normal_option_title":"Se te notificará si este usuario te responde, cita o menciona."},"activity_stream":"Actividad","preferences":"Preferencias","feature_topic_on_profile":{"open_search":"Selecciona un nuevo tema","title":"Selecciona un tema","search_label":"Buscar tema por título","save":"Guardar","clear":{"title":"Quitar filtros","warning":"¿Estás seguro de que quieres eliminar tu tema destacado?"}},"use_current_timezone":"Usar zona horaria actual","profile_hidden":"El perfil público de este usuario está oculto.","expand_profile":"Expandir","collapse_profile":"Contraer","bookmarks":"Marcadores","bio":"Acerca de mí","timezone":"Zona horaria","invited_by":"Invitado por","trust_level":"Nivel de confianza","notifications":"Notificaciones","statistics":"Estadísticas","desktop_notifications":{"label":"Notificaciones en vivo","not_supported":"Las notificaciones no están disponibles en este navegador. Lo sentimos.","perm_default":"Activar notificaciones","perm_denied_btn":"Permiso denegado","perm_denied_expl":"Has denegado el permiso para las notificaciones. Configura tu navegador para permitir notificaciones. ","disable":"Desactivar notificaciones","enable":"Activar notificaciones","each_browser_note":"Nota: Tendrás que cambiar esta opción para cada navegador que uses.","consent_prompt":"¿Quieres recibir notificaciones en vivo cuando alguien responda a tus mensajes?"},"dismiss":"Descartar","dismiss_notifications":"Descartar todos","dismiss_notifications_tooltip":"Marcar todas las notificaciones no leídas como leídas","first_notification":"¡Tu primera notificación! Selecciónala para comenzar.","dynamic_favicon":"Mostrar número en el icono del navegador","theme_default_on_all_devices":"Hacer que este sea el tema por defecto en todos mis dispositivos","text_size_default_on_all_devices":"Hacer que este sea el tamaño por defecto en todos mis dispositivos","allow_private_messages":"Permitir que otros usuarios me envíen mensajes privados","external_links_in_new_tab":"Abrir todos los enlaces externos en una nueva pestaña","enable_quoting":"Activar respuesta citando el texto resaltado","enable_defer":"Activar diferir para marcar temas no leídos","change":"cambio","featured_topic":"Tema destacado","moderator":"{{user}} es un moderador","admin":"{{user}} es un administrador","moderator_tooltip":"Este usuario es un moderador","admin_tooltip":"Este usuario es un administrador","silenced_tooltip":"Este usuario está silenciado","suspended_notice":"Este usuario ha sido suspendido hasta {{date}}.","suspended_permanently":"Este usuario está suspendido.","suspended_reason":"Causa: ","github_profile":"Github","email_activity_summary":"Resumen de actividad","mailing_list_mode":{"label":"Modo lista de correo","enabled":"Activar modo lista de correo","instructions":"Esta opción sobrescribe el resumen de actividad.\u003cbr /\u003e\nLos temas y categorías silenciados no se incluyen en estos correos electrónicos.\n","individual":"Enviar un correo electrónico por cada publicación nueva","individual_no_echo":"Enviar un correo electrónico por cada publicación nueva excepto aquellas publicadas por mí","many_per_day":"Envíame un correo electrónico por cada publicación nueva (unos {{dailyEmailEstimate}} por día)","few_per_day":"Envíame un correo electrónico por cada publicación nueva (unos 2 por día)","warning":"Modo de lista de correo habilitado. La configuración de notificaciones por correo electrónico está anulada."},"tag_settings":"Etiquetas","watched_tags":"Vigiladas","watched_tags_instructions":"Vigilarás automáticamente todos los temas con estas etiquetas. Se te notificarán todas las publicaciones y temas nuevos y aparecerá un contador de publicaciones nuevas al lado del tema.","tracked_tags":"Siguiendo","tracked_tags_instructions":"Seguirás automáticamente todos los temas con estas etiquetas. Aparecerá un contador de publicaciones nuevas al lado del tema.","muted_tags":"Silenciadas","muted_tags_instructions":"No recibirás notificaciones de ningún tema con estas etiquetas y estas no aparecerán en la pestaña Recientes.","watched_categories":"Vigiladas","watched_categories_instructions":"Vigilarás automáticamente todos los temas en estas categorías. Se te notificarán todos las publicaciones y temas nuevos y aparecerá un contador de publicaciones nuevas al lado del tema.","tracked_categories":"Siguiendo","tracked_categories_instructions":"Seguirás automáticamente todos los temas en estas categorías. Aparecerá un contador de publicaciones nuevas al lado del tema.","watched_first_post_categories":"Vigilar la primera publicación","watched_first_post_categories_instructions":"Se te notificará la primera publicación en cada tema nuevo en estas categorías.","watched_first_post_tags":"Vigilando la primera publicación","watched_first_post_tags_instructions":"Se te notificará la primera publicación en cada tema nuevo con estas etiquetas.","muted_categories":"Silenciado","muted_categories_instructions":"No se te notificará acerca de ningún tema en estas categorías y no aparecerán en la página de categorías o mensajes recientes.","muted_categories_instructions_dont_hide":"No se te notificará nada acerca de temas nuevos en estas categorías.","no_category_access":"Como moderador tienes acceso limitado a categorías. Guardar está deshabilitado.","delete_account":"Eliminar mi cuenta","delete_account_confirm":"¿Estás seguro de que quieres eliminar permanentemente tu cuenta? ¡Esta acción no puede ser revertida!","deleted_yourself":"Tu cuenta se ha eliminado exitosamente.","delete_yourself_not_allowed":"Por favor, contacta a un miembro del staff si deseas que se elimine tu cuenta.","unread_message_count":"Mensajes","admin_delete":"Eliminar","users":"Usuarios","muted_users":"Silenciados","muted_users_instructions":"Omite todas las notificaciones de estos usuarios.","ignored_users":"Ignorados","ignored_users_instructions":"Omitir todas las publicaciones y mensajes de estos usuarios.","tracked_topics_link":"Mostrar","automatically_unpin_topics":"Dejar de destacar temas automáticamente cuando los leo por completo.","apps":"Aplicaciones","revoke_access":"Revocar acceso","undo_revoke_access":"Deshacer revocación de acceso","api_approved":"Fecha de aprobación:","api_last_used_at":"Fecha de último uso:","theme":"Tema","home":"Página de inicio por defecto","staged":"Temporal","staff_counters":{"flags_given":"reportes útiles","flagged_posts":"publicaciones reportadas","deleted_posts":"publicaciones eliminadas","suspensions":"suspensiones","warnings_received":"avisos","rejected_posts":"publicaciones rechazadas"},"messages":{"all":"Todos","inbox":"Bandeja de entrada","sent":"Enviados","archive":"Archivo","groups":"Mis grupos","bulk_select":"Mensajes seleccionados","move_to_inbox":"Mover a la bandeja de entrada","move_to_archive":"Archivar","failed_to_move":"No se han podido mover los mensajes seleccionados (podrías estar teniendo problemas de conexión)","select_all":"Seleccionar todo","tags":"Etiquetas"},"preferences_nav":{"account":"Cuenta","profile":"Perfil","emails":"Correos electrónicos","notifications":"Notificaciones","categories":"Categorías","users":"Usuarios","tags":"Etiquetas","interface":"Interfaz","apps":"Aplicaciones"},"change_password":{"success":"(correo electrónico enviado)","in_progress":"(enviando correo electrónico)","error":"(error)","emoji":"emoji de un candado","action":"Enviar correo electrónico para restablecer la contraseña","set_password":"Establecer contraseña","choose_new":"Escoge una nueva contraseña","choose":"Escoge una contraseña"},"second_factor_backup":{"title":"Códigos de respaldo de la autenticación en dos pasos","regenerate":"Regenerar","disable":"Habilitar","enable":"Deshabilitar","enable_long":"Habilitar códigos de respaldo","manage":"Administrar los códigos de respaldo. Tienes \u003cstrong\u003e{{count}}\u003c/strong\u003e códigos de respaldo restantes.","copied_to_clipboard":"Copiado al portapapeles","copy_to_clipboard_error":"Error al copiar datos al portapapeles","remaining_codes":"Tienes \u003cstrong\u003e{{count}}\u003c/strong\u003e códigos de respaldo restantes.","use":"Usar un código de respaldo","enable_prerequisites":"Debes habilitar un segundo factor primario antes de generar códigos de respaldo.","codes":{"title":"Códigos de respaldo generados","description":"Cada uno de estos códigos de respaldo puede ser usado una única vez. Manténlos en un lugar seguro pero accesible."}},"second_factor":{"title":"Autenticación en dos pasos","enable":"Gestionar autenticación en dos pasos","forgot_password":"¿Olvidaste tu contraseña?","confirm_password_description":"Por favor, confirma tu contraseña para continuar","name":"Nombre","label":"Código","rate_limit":"Por favor, espera antes de intentar utilizar otro código de autenticación.","enable_description":"Escanea este código QR en una aplicación que lo soporte (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) e ingresa el código de autenticación.\n","disable_description":"Por favor, ingresa el código de autenticación que aparece en tu aplicación","show_key_description":"Ingresa el código manualmente","short_description":"Protege tu cuenta mediante códigos de respaldo de un solo uso.\n","extended_description":"La verificación en dos pasos incrementa la seguridad de tu cuenta al requerir un código de único solo uso además de tu contraseña. Los códigos se pueden generar tanto en dispositivos \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e como \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e.\n","oauth_enabled_warning":"Por favor, ten en cuenta que el acceso a tu cuenta a través de redes sociales se inhabilitará si activas la autenticación en dos pasos.","use":"Usar app Authenticator","enforced_notice":"Se necesita que actives la autenticación en dos pasos antes de acceder a este sitio.","disable":"inhabilitar","disable_title":"Inhabilitar segundo factor","disable_confirm":"¿Estás seguro de que quieres inhabilitar todos los segundos factores?","edit":"Editar","edit_title":"Editar segundo factor","edit_description":"Nombre del segundo factor","enable_security_key_description":"Cuando tengas tu clave de seguridad física preparada, presione el botón de registro que se encuentra debajo.","totp":{"title":"Autenticación basada en tokens","add":"Nuevo autenticador","default_name":"Mi autenticador","name_and_code_required_error":"Debes introducir un nombre y un código de tu aplicación de autentificación."},"security_key":{"register":"Registrar","title":"Claves de seguridad","add":"Clave de seguridad de registro","default_name":"Clave de seguridad principal","not_allowed_error":"El proceso de registro de clave de seguridad fue cancelado o se agotó el tiempo.","already_added_error":"Ya registraste esta clave de seguridad. No tienes que registrarla de nuevo.","edit":"Editar clave de seguridad","edit_description":"Nombre de la clave de seguridad","delete":"Eliminar","name_required_error":"Debes introducir un nombre para tu llave de seguridad."}},"change_about":{"title":"Cambiar «Acerca de mí»","error":"Ha ocurrido un error al cambiar este valor."},"change_username":{"title":"Cambiar nombre de usuario","confirm":"¿Estás completamente seguro de que quieres cambiar tu nombre de usuario?","taken":"Lo sentimos, ese nombre de usuario ya se encuentra en uso.","invalid":"Este nombre de usuario no es válido. Este solo puede incluir números y letras"},"change_email":{"title":"Cambiar correo electrónico","taken":"Lo sentimos, ese correo electrónico no está disponible.","error":"Ha ocurrido un error al cambiar tu correo electrónico. ¿Tal vez esa dirección ya se encuentra en uso?","success":"Te hemos enviado un correo electrónico a esa dirección. Por favor, sigue las instrucciones de confirmación.","success_staff":"Hemos enviado un correo electrónico a tu dirección actual. Por favor, sigue las instrucciones de confirmación."},"change_avatar":{"title":"Cambiar tu imagen de perfil","gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e, basado en","gravatar_title":"Cambia tu avatar en la pagina web de {{gravatarName}}","gravatar_failed":"No pudimos encontrar un {{gravatarName}} con esa dirección de correo electrónico.","refresh_gravatar_title":"Actualiza tu {{gravatarName}}","letter_based":"Imagen de perfil asignada por el sistema","uploaded_avatar":"Foto personalizada","uploaded_avatar_empty":"Agrega una foto personalizada","upload_title":"Sube tu foto","image_is_not_a_square":"Advertencia: hemos recortado tu imagen porque la anchura y la altura no eran iguales."},"change_profile_background":{"title":"Encabezado de perfil","instructions":"Por defecto, los encabezados de perfil estarán centrados y tendrán una anchura de 1110px."},"change_card_background":{"title":"Fondo de tarjeta de usuario","instructions":"Las imágenes de fonodo estarán centradas y tendrán una anchura predeterminada de 590 px."},"change_featured_topic":{"title":"Tema destacado","instructions":"Un enlace a este tema estará en tu tarjeta de usuario y perfil."},"email":{"title":"Correo electrónico","primary":"Correo electrónico principal","secondary":"Correos electrónicos secundarios","no_secondary":"Sin correos electrónicos secundarios","sso_override_instructions":"El correo electrónico puede actualizarse desde el proveedor de SSO.","instructions":"Nunca se mostrará al público.","ok":"Te enviaremos un correo electrónico para confirmar","invalid":"Por favor, ingresa una dirección de correo electrónico válida","authenticated":"Tu  correo electrónico ha sido autenticado por {{provider}}","frequency_immediately":"Te enviaremos un correo electrónico inmediatamente si no has leído el asunto por el cual te estamos enviando el correo.","frequency":{"one":"Sólo te enviaremos emails si no te hemos visto en el último minuto.","other":"Solo te enviaremos un correo electrónico si no te hemos visto en los últimos {{count}} minutos."}},"associated_accounts":{"title":"Cuentas asociadas","connect":"Conectar","revoke":"Revocar","cancel":"Cancelar","not_connected":"(no conectada)","confirm_modal_title":"Conectar cuenta de %{provider}","confirm_description":{"account_specific":"Tu cuenta de %{provider} «%{account_description}» se utilizará para la autenticación.","generic":"Tu cuenta de %{provider} se utilizará para la autenticación."}},"name":{"title":"Nombre","instructions":"tu nombre completo (opcional)","instructions_required":"Tu nombre completo","too_short":"Tu nombre es demasiado corto","ok":"Tu nombre se ve adecuado"},"username":{"title":"Nombre de usuario","instructions":"único, sin espacios y corto","short_instructions":"Los demás usuarios pueden mencionarte como @{{username}}","available":"Tu nombre de usuario está disponible","not_available":"No disponible. ¿Deseas intentar {{suggestion}}?","not_available_no_suggestion":"No disponible","too_short":"Tu nombre de usuario es demasiado corto","too_long":"Tu nombre de usuario es demasiado largo","checking":"Comprobando la disponibilidad del nombre de usuario...","prefilled":"El correo electrónico coincide con el nombre de usuario registrado"},"locale":{"title":"Idioma de la interfaz","instructions":"Idioma de la interfaz. Cambiará cuando recargues la página.","default":"(por defecto)","any":"cualquiera"},"password_confirmation":{"title":"Ingresa de nuevo la contraseña"},"invite_code":{"title":"Código de invitación","instructions":"El registro de la cuenta requiere un código de invitación"},"auth_tokens":{"title":"Dispositivos utilizados recientemente","ip":"IP","details":"Detalles","log_out_all":"Cerrar sesión en todos los dispositivos","active":"activo ahora","not_you":"¿No eres tú?","show_all":"Mostrar todos ({{count}})","show_few":"Mostrar menos","was_this_you":"¿Fuiste tú?","was_this_you_description":"Si no fuiste tú, te recomendamos que cambies tu contraseña y cierres sesión en todos los dispositivos.","browser_and_device":"{{browser}} en {{device}}","secure_account":"Asegurar mi cuenta","latest_post":"Publicaste por última vez..."},"last_posted":"Última publicación","last_emailed":"Último correo electrónico enviado","last_seen":"Visto por última vez","created":"Creado el","log_out":"Cerrar sesión","location":"Ubicación","website":"Sitio web","email_settings":"Correo electrónico","hide_profile_and_presence":"Ocultar mi perfil público y elementos de presencia","enable_physical_keyboard":"Activar soporte de teclado físico en iPad","text_size":{"title":"Tamaño del texto","smaller":"Pequeño","normal":"Normal","larger":"Grande","largest":"Muy grande"},"title_count_mode":{"title":"El título de la página muestra una cuenta de:","notifications":"Notificaciones nuevas","contextual":"Contenido nuevo en la página"},"like_notification_frequency":{"title":"Notificar cuando me dan me gusta","always":"Siempre","first_time_and_daily":"Cuando mi publicación reciba el primer me gusta y luego diariamente si recibe más","first_time":"Cuando mi publicación reciba el primer me gusta","never":"Nunca"},"email_previous_replies":{"title":"Incluir respuestas previas en la parte inferior de los correos electrónicos","unless_emailed":"a menos que se hayan enviado previamente","always":"siempre","never":"nunca"},"email_digests":{"title":"Cuando no visite el sitio, enviarme un correo electrónico con un resumen de los temas y respuestas populares","every_30_minutes":"cada 30 minutos","every_hour":"cada hora","daily":"diariamente","weekly":"semanalmente","every_month":"cada mes","every_six_months":"cada seis meses"},"email_level":{"title":"Enviarme un correo electrónico cuando alguien me cite, me responda, mencione mi @nombre de usuario o me invite a un tema","always":"siempre","only_when_away":"solo cuando no esté en la página","never":"nunca"},"email_messages_level":"Enviarme un correo electrónico cuando alguien me mande un mensaje","include_tl0_in_digests":"Incluir contenido de usuarios nuevos en los correos electrónicos de resumen","email_in_reply_to":"Incluir un extracto de la publicación que recibió una respuesta en los correo electrónicos","other_settings":"Otros","categories_settings":"Categorías","new_topic_duration":{"label":"Considerar que los temas son nuevos cuando","not_viewed":"No los he visto todavía","last_here":"creados desde mi última visita","after_1_day":"creados durante el último día ","after_2_days":"creados durante los últimos 2 días","after_1_week":"creados durante la última semana","after_2_weeks":"creados durante las últimas 2 semanas"},"auto_track_topics":"Seguir automáticamente temas en los que entre","auto_track_options":{"never":"nunca","immediately":"inmediatamente","after_30_seconds":"después de 30 segundos","after_1_minute":"después de 1 minuto","after_2_minutes":"después de 2 minutos","after_3_minutes":"después de 3 minutos","after_4_minutes":"después de 4 minutos","after_5_minutes":"después de 5 minutos","after_10_minutes":"después de 10 minutos"},"notification_level_when_replying":"Cuando publique en un tema, cambia el nivel de seguimiento a","invited":{"search":"escribe para buscar invitaciones...","title":"Invitaciones","user":"Usuario invitado","sent":"Última vez enviada","none":"Sin invitaciones para mostrar.","truncated":{"one":"Mostrando la primera invitación.","other":"Mostrando las primeras {{count}} invitaciones."},"redeemed":"Invitaciones aceptadas","redeemed_tab":"Aceptada","redeemed_tab_with_count":"Aceptadas ({{count}})","redeemed_at":"Aceptada","pending":"Invitaciones pendientes","pending_tab":"Pendiente","pending_tab_with_count":"Pendientes ({{count}})","topics_entered":"Temas vistos","posts_read_count":"Publicaciones leídas","expired":"Esta invitación ha caducado.","rescind":"Eliminar","rescinded":"Invitación eliminada","rescind_all":"Eliminar todas las invitaciones expiradas","rescinded_all":"¡Todas las invitaciones expiradas se han eliminado!","rescind_all_confirm":"¿Estás seguro de querer eliminar todas las invitaciones expiradas?","reinvite":"Reenviar Invitación","reinvite_all":"Reenviar todas las invitaciones","reinvite_all_confirm":"¿Estás seguro de que quieres reenviar todas las invitaciones?","reinvited":"Invitación reenviada","reinvited_all":"¡Todas las invitaciones se han reenviado!","time_read":"Tiempo de lectura","days_visited":"Días visitados","account_age_days":"Antigüedad de la cuenta en días","create":"Enviar una invitación","generate_link":"Copiar enlace de invitación","link_generated":"¡Enlace de invitación generado satisfactoriamente!","valid_for":"El enlace de invitación solo es válido para esta dirección de correo electrónico: %{email}","bulk_invite":{"none":"No has invitado a nadie aún. Puedes enviar invitaciones individuales o invitar a varias personas a la vez \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003esubiendo un archivo CVS\u003c/a\u003e.","text":"Invitación masiva desde archivo","success":"Archivo subido correctamente, se te notificará mediante un mensaje cuando se complete el proceso.","error":"Lo sentimos, el formato del archivo debe ser CSV. ","confirmation_message":"Estás a punto de enviar invitaciones por correo electrónico a todas las direcciones en el archivo subido."}},"password":{"title":"Contraseña","too_short":"Tu contraseña es demasiada corta.","common":"Esta contraseña es demasiado común.","same_as_username":"Tu contraseña es la misma que tu nombre de usuario.","same_as_email":"Tu contraseña es la misma que tu correo electrónico.","ok":"Tu contraseña es válida.","instructions":"debe tener al menos %{count} caracteres"},"summary":{"title":"Resumen","stats":"Estadísticas","time_read":"tiempo de lectura","recent_time_read":"tiempo de lectura reciente","topic_count":{"one":"tema creado","other":"temas creados"},"post_count":{"one":"post publicado","other":"publicaciones creadas"},"likes_given":{"one":"dado","other":"dados"},"likes_received":{"one":"recibido","other":"recibidos"},"days_visited":{"one":"día visitado","other":"días visitados"},"topics_entered":{"one":"tema visto","other":"temas vistos"},"posts_read":{"one":"post leído","other":"publicaciones leídas"},"bookmark_count":{"one":"marcador","other":"marcadores"},"top_replies":"Respuestas destacadas","no_replies":"No hay respuestas aún.","more_replies":"Más respuestas","top_topics":"Temas destacados","no_topics":"No hay temas aún.","more_topics":"Más temas","top_badges":"Medallas destacadas","no_badges":"Todavía no hay medallas.","more_badges":"Más medallas","top_links":"Enlaces destacados","no_links":"No hay enlaces aún.","most_liked_by":"Recibió mas me gusta de","most_liked_users":"Dio más me gusta a","most_replied_to_users":"Respondió más a","no_likes":"No hay ningún me gusta aún.","top_categories":"Categorías destacadas","topics":"Temas","replies":"Respuestas"},"ip_address":{"title":"Última dirección IP"},"registration_ip_address":{"title":"Dirección IP del registro"},"avatar":{"title":"Imagen de perfil","header_title":"perfil, mensajes, marcadores y preferencias"},"title":{"title":"Título","none":"(ninguno)"},"primary_group":{"title":"Grupo principal","none":"(ninguno)"},"filters":{"all":"Todos"},"stream":{"posted_by":"Publicado por","sent_by":"Enviado por","private_message":"mensaje","the_topic":"el tema"}},"loading":"Cargando...","errors":{"prev_page":"mientras se intentaba cargar","reasons":{"network":"Error de red","server":"Error del servidor","forbidden":"Acceso denegado","unknown":"Error","not_found":"Página no encontrada"},"desc":{"network":"Por favor, revisa tu conexión.","network_fixed":"Parece que ha vuelto.","server":"Código de error: {{status}}","forbidden":"No tienes permitido ver esto.","not_found":"¡Ups! La aplicación intentó cargar una URL inexistente.","unknown":"Algo salió mal."},"buttons":{"back":"Volver atrás","again":"Intentar de nuevo","fixed":"Cargar página"}},"modal":{"close":"cerrar","dismiss_error":"Descartar error"},"close":"Cerrar","assets_changed_confirm":"Este sitio acaba de ser actualizado. ¿Quieres cargar la página de nuevo para ver la última versión?","logout":"Has cerrado sesión.","refresh":"Actualizar","read_only_mode":{"enabled":"Este sitio está en modo de solo lectura. Puedes continuar navegando pero algunas acciones como responder o dar me gusta no están disponibles por ahora.","login_disabled":"Iniciar sesión está desactivado mientras el foro se encuentre en modo de solo lectura.","logout_disabled":"Cerrar sesión está desactivado mientras el sitio se encuentre en modo de solo lectura."},"logs_error_rate_notice":{},"learn_more":"saber más...","all_time":"total","all_time_desc":"total de temas creados","year":"año","year_desc":"temas creados en los últimos 365 días","month":"mes","month_desc":"temas creados en los últimos 30 días","week":"semana","week_desc":"temas creados en los últimos 7 días","day":"día","first_post":"Primera publicación","mute":"Silenciar","unmute":"No silenciar","last_post":"Publicado","time_read":"Leído","time_read_recently":"%{time_read} recientemente","time_read_tooltip":"%{time_read} tiempo de lectura total","time_read_recently_tooltip":"%{time_read} tiempo de lectura total (%{recent_time_read} en los últimos 60 días)","last_reply_lowercase":"última respuesta","replies_lowercase":{"one":"respuesta","other":"respuestas"},"signup_cta":{"sign_up":"Registrarse","hide_session":"Recúerdame mañana","hide_forever":"no, gracias","hidden_for_session":"Vale, te preguntaremos mañana. Recuerda que también puedes usar el botón «Iniciar sesión» para crear una cuenta en cualquier momento.","intro":"¡Hola! Parece que estás disfrutando la discusión, pero no has creado una cuenta todavía.","value_prop":"Cuando creas una cuenta, recordamos exactamente lo que has leído de modo que puedas retomar lo que leías justo donde lo dejaste. También recibes notificaciones, por aquí y por correo electrónico, cuando alguien responde a tus mensajes. ¡También puedes darle «me gusta» a los mensajes para compartir amor! :heartpulse:"},"summary":{"enabled_description":"Estás viendo un resumen de este tema: las publicaciones más interesantes de acuerdo a la comunidad.","description":"Hay \u003cb\u003e{{replyCount}}\u003c/b\u003e respuestas.","description_time":"Hay \u003cb\u003e{{replyCount}}\u003c/b\u003e respuestas con un tiempo de lectura estimado de \u003cb\u003e{{readingTime}} minutos\u003c/b\u003e.","enable":"Resumir este tema","disable":"Ver todas las publicaciones"},"deleted_filter":{"enabled_description":"Este tema contiene publicaciones eliminadas que se han ocultado.","disabled_description":"Se muestran las publicaciones eliminadas de este tema. ","enable":"Ocultar publicaciones eliminadas","disable":"Mostrar publicaciones eliminadas"},"private_message_info":{"title":"Mensaje","invite":"Invitar a otros...","edit":"Añadir o quitar...","leave_message":"¿Estás seguro de que quieres abandonar este mensaje?","remove_allowed_user":"¿Estás seguro de que quieres eliminar a {{name}} de este mensaje?","remove_allowed_group":"¿Estás seguro de que quieres eliminar a {{name}} de este mensaje?"},"email":"Correo electrónico","username":"Nombre de usuario","last_seen":"Visto por última vez","created":"Creado","created_lowercase":"creado","trust_level":"Nivel de confianza","search_hint":"usuario, correo electrónico o dirección IP","create_account":{"disclaimer":"Al registrarte aceptas la \u003ca href='{{privacy_link}}' target='blank'\u003ePolítica de privacidad\u003c/a\u003e y los \u003ca href='{{tos_link}}' target='blank'\u003eTérminos de servicio\u003c/a\u003e.","title":"Crear cuenta nueva","failed":"Algo salió mal. Quizás este correo electrónico ya se encuentra registrado. Intenta con el enlace «olvidé la contraseña»"},"forgot_password":{"title":"Restablecer contraseña","action":"Olvidé mi contraseña","invite":"Ingresa tu nombre de usuario o tu dirección de correo electrónico, y te enviaremos un correo electrónico para restablecer tu contraseña.","reset":"Restablecer contraseña","complete_username":"Si una cuenta coincide con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e, en breve deberías recibir un correo electrónico con las instrucciones para restablecer tu contraseña.","complete_email":"Si una cuenta coincide con \u003cb\u003e%{email}\u003c/b\u003e, en breve deberías recibir un correo electrónico con las instrucciones para restablecer tu contraseña.","complete_username_found":"Encontramos una cuenta que coincide con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e. Debes recibir pronto un correo electrónico con instrucciones para restablecer tu contraseña.","complete_email_found":"Encontramos una cuenta que coincide con el correo electrónico \u003cb\u003e%{email}\u003c/b\u003e. Debes recibir pronto un correo electrónico con instrucciones para restablecer tu contraseña.","complete_username_not_found":"No hay ninguna cuenta que coincida con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"No hay ninguna cuenta que coincida con el correo electrónico \u003cb\u003e%{email}\u003c/b\u003e","help":"¿No te ha llegado el correo? Asegúrate de comprobar primero tu carpeta de correo no deseado. \u003cp\u003e¿No estás seguro de qué correo has usado? Ingresa tu correo electrónico y te avisaremos si lo tenemos registrado.\u003c/p\u003e\u003cp\u003eSi no tienes acceso al correo electrónico asociado a tu cuenta, por favor, contacta \u003ca href='%{basePath}/about'\u003ea nuestro amable staff.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Ayuda"},"email_login":{"link_label":"Enviarme un enlace para ingresar por correo electrónico","button_label":"con correo electrónico","emoji":"emoji de candado","complete_username":"Si una cuenta coincide con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e, en breve deberías recibir un correo electrónico con un enlace para ingresar a tu cuenta.","complete_email":"Si una cuenta coincide con \u003cb\u003e%{email}\u003c/b\u003e, en breve deberías recibir un correo electrónico con un enlace para ingresar a tu cuenta.","complete_username_found":"Encontramos una cuenta que coincide con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e, en breve deberías recibir un correo electrónico con un enlace para ingresar a tu cuenta.","complete_email_found":"Encontramos una cuenta que coincide con \u003cb\u003e%{email}\u003c/b\u003e, deberías recibir un email con un enlace de ingreso en breve.","complete_username_not_found":"No hay ninguna cuenta que coincida con el nombre de usuario \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"No hay ninguna cuenta que coincida con el correo electrónico \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Continuar a %{site_name}","logging_in_as":"Iniciando sesión como %{email}","confirm_button":"Finalizar inicio de sesión"},"login":{"title":"Iniciar sesión","username":"Usuario","password":"Contraseña","second_factor_title":"Autenticación en dos pasos","second_factor_description":"Por favor, ingresa el código de autenticación desde tu aplicación:","second_factor_backup":"Iniciar sesión utilizando un código de respaldo","second_factor_backup_title":"Respaldo de la autenticación en dos pasos","second_factor_backup_description":"Por favor, ingresa uno de los códigos de respaldo:","second_factor":"Iniciar sesión utilizando la app Authenticator","security_key_description":"Cuando tengas tu clave de seguridad física preparada, presiona el botón de autenticar con clave de seguridad que se encuentra debajo.","security_key_alternative":"Intenta de otra manera","security_key_authenticate":"Autenticar con clave de seguridad","security_key_not_allowed_error":"La autenticación de la clave de seguridad fue cancelada o se agotó el tiempo.","security_key_no_matching_credential_error":"No se encontraron credenciales que coincidan en la clave de seguridad provista.","security_key_support_missing_error":"Tu dispositivo o navegador actual no soporta el uso de claves de seguridad. Por favor, utiliza un método diferente.","email_placeholder":"correo electrónico o nombre de usuario","caps_lock_warning":"El bloqueo de mayúsculas está activado","error":"Error desconocido","cookies_error":"Parece que tu navegador tiene deshabilitados los cookies. Es posible que no puedas iniciar sesión sin habilitarlos primero.","rate_limit":"Por favor, espera un poco antes intentar iniciar sesión de nuevo.","blank_username":"Por favor, ingresa tu correo electrónico o nombre de usuario.","blank_username_or_password":"Por favor, ingresa tu correo electrónico o nombre de usuario y tu contraseña.","reset_password":"Restablecer contraseña","logging_in":"Iniciando Sesión...","or":"O","authenticating":"Autenticando...","awaiting_activation":"Tu cuenta está pendiente de activación, usa el enlace de «olvidé contraseña» para recibir otro correo electrónico de activación.","awaiting_approval":"Tu cuenta todavía no ha sido aprobada por un miembro del staff. Recibirás un correo electrónico cuando sea aprobada.","requires_invite":"Lo sentimos, solo se puede acceder a este foro mediante invitación.","not_activated":"No puedes iniciar sesión todavía. Anteriormente te hemos enviado un correo electrónico de activación a la dirección \u003cb\u003e{{sentTo}}\u003c/b\u003e. Por favor, sigue las instrucciones que allí se encuentran para activar tu cuenta.","not_allowed_from_ip_address":"No puedes iniciar sesión desde esa dirección IP.","admin_not_allowed_from_ip_address":"No puedes iniciar sesión como administrador desde esta dirección IP.","resend_activation_email":"Has clic aquí para enviar el correo electrónico de activación nuevamente.","omniauth_disallow_totp":"Tu cuenta tiene activada la autenticación en dos pasos. Por favor, ingresa usando tu contraseña.","resend_title":"Volver a enviar el correo electrónico de activación","change_email":"Cambiar dirección de correo electrónico","provide_new_email":"Ingresa una dirección de correo electrónico nueva y te reenviaremos el correo electrónico de confirmación.","submit_new_email":"Actualizar dirección de correo electrónico","sent_activation_email_again":"Te hemos enviado otro correo electrónico de activación a \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Podría tardar algunos minutos en llegar; asegúrate de revisar la carpeta de correo no deseado.","sent_activation_email_again_generic":"Te hemos enviado otro correo  electrónico de activación. Podría tardar algunos minutos en llegar. Asegúrate de revisar la carpeta de correo no deseado.","to_continue":"Por favor, inicia sesión","preferences":"Debes iniciar sesión para poder cambiar tus preferencias de usuario.","forgot":"No me acuerdo de los detalles de mi cuenta.","not_approved":"Tu cuenta aún no ha sido aprobada. Se te notificará por correo electrónico cuando todo esté listo para que inicies sesión.","google_oauth2":{"name":"Google","title":"con Google"},"twitter":{"name":"Twitter","title":"con Twitter"},"instagram":{"name":"Instagram","title":"con Instagram"},"facebook":{"name":"Facebook","title":"con Facebook"},"github":{"name":"GitHub","title":"con GitHub"},"discord":{"name":"Discord","title":"con Discord"},"second_factor_toggle":{"totp":"Usar una aplicación de autenticación en su lugar","backup_code":"Usar un código de respaldo en su lugar"}},"invites":{"accept_title":"Invitación","emoji":"emoji de un sobre","welcome_to":"¡Bienvenido a %{site_name}!","invited_by":"Has sido invitado por:","social_login_available":"También tendrás la posibilidad de iniciar sesión mediante cualquier red social asociada a ese correo electrónico.","your_email":"El correo electrónico de tu cuenta es \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Aceptar invitación","success":"Tu cuenta ha sido creada y has iniciado sesión.","name_label":"Nombre","password_label":"Establecer contraseña","optional_description":"(opcional)"},"password_reset":{"continue":"Continuar a %{site_name}"},"emoji_set":{"apple_international":"Apple/Internacional","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (anteriormente EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Solo categorías","categories_with_featured_topics":"Categorías con temas destacados","categories_and_latest_topics":"Categorías y temas recientes","categories_and_top_topics":"Categorías y temas más importantes","categories_boxes":"Cajas con subcategorías","categories_boxes_with_topics":"Cajas con temas destacados"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Intro"},"conditional_loading_section":{"loading":"Cargando..."},"category_row":{"topic_count":"{{count}} temas en esta categoría"},"select_kit":{"default_header_text":"Seleccionar...","no_content":"No se encontraron coincidencias","filter_placeholder":"Buscar...","filter_placeholder_with_any":"Buscar o crear...","create":"Crear: «{{content}}»","max_content_reached":{"one":"Puedes seleccionar únicamente {{count}} item.","other":"Solo puedes seleccionar {{count}} elementos."},"min_content_not_reached":{"one":"Seleccionar al menos {{count}} item.","other":"Selecciona al menos {{count}} elementos."},"invalid_selection_length":"La selección debe tener al menos {{count}} caracteres."},"date_time_picker":{"from":"Desde","to":"Hasta","errors":{"to_before_from":"La fecha «hasta» debe ser posterior a la fecha «desde»."}},"emoji_picker":{"filter_placeholder":"Buscar emoji","smileys_\u0026_emotion":"Caras y emociones","people_\u0026_body":"Personas y cuerpo","animals_\u0026_nature":"Animales y naturaleza","food_\u0026_drink":"Comida y bebida","travel_\u0026_places":"Viajes y lugares","activities":"Actividades","objects":"Objetos","symbols":"Símbolos","flags":"Banderas","recent":"Usados recientemente ","default_tone":"Sin tono de piel","light_tone":"Tono de piel claro","medium_light_tone":"Tono de piel medio claro","medium_tone":"Tono de piel medio","medium_dark_tone":"Tono de piel medio oscuro","dark_tone":"Tono de piel oscuro","default":"Emojis personalizados"},"shared_drafts":{"title":"Borradores Compartidos","notice":"Este tema es visible solamente por quienes pueden ver la categoría \u003cb\u003e{{category}}\u003c/b\u003e.","destination_category":"Categoría de destino","publish":"Publicar borrador compartido","confirm_publish":"¿Estás seguro de que quieres publicar este borrador?","publishing":"Publicando Tema..."},"composer":{"emoji":"Emoji :)","more_emoji":"más...","options":"Opciones","whisper":"susurrar","unlist":"invisible","blockquote_text":"Cita","add_warning":"Esta es una advertencia oficial.","toggle_whisper":"Activar/desactivar susurro","toggle_unlisted":"Visible/Invisible","posting_not_on_topic":"¿A qué tema quieres responder?","saved_local_draft_tip":"guardado localmente","similar_topics":"Tu tema es similar a...","drafts_offline":"borradores sin conexión","edit_conflict":"conflicto de edición","group_mentioned_limit":"\u003cb\u003e¡Advertencia!\u003c/b\u003e Mencionaste a \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e. Sin embargo, este grupo tiene más miembros que el límite máximo de menciones que el administrador configuró. Este límite es de {{max}} usuarios. Por consiguiente, no se notificará a nadie.","group_mentioned":{"one":"Al mencionar a {{group}}, estás a punto de notificar a \u003ca href='{{group_link}}'\u003e%{count} persona\u003c/a\u003e – ¿seguro que quieres hacerlo?","other":"Al mencionar a {{group}}, estás a punto de notificar a \u003ca href='{{group_link}}'\u003e{{count}} personas\u003c/a\u003e ¿Estás seguro de que quieres hacerlo?"},"cannot_see_mention":{"category":"Mencionaste a {{username}} pero no se les notificará porque no tienen acceso a esta categoría. Necesitarás añadirlos a un grupo que tenga acceso a esta categoría.","private":"Mencionaste a {{username}} pero no se les notificará porque no pueden ver este mensaje personal. Necesitarás invitarlos a este MP."},"duplicate_link":"Parece que tu enlace a \u003cb\u003e{{domain}}\u003c/b\u003e ya se publicó en el tema por \u003cb\u003e@{{username}}\u003c/b\u003e en \u003ca href='{{post_url}}'\u003euna respuesta el {{ago}}\u003c/a\u003e. ¿Estás seguro de que deseas volver a publicarlo?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Es necesario un título","title_too_short":"El título debe tener por lo menos {{min}} caracteres","title_too_long":"El título no puede tener más de {{max}} caracteres.","post_missing":"La publicación no puede estar vacía","post_length":"La publicación debe tener por lo menos {{min}} caracteres.","try_like":"¿Has probado el botón {{heart}}?","category_missing":"Debes escoger una categoría.","tags_missing":"Debes seleccionar al menos {{count}} etiquetas","topic_template_not_modified":"Por favor, agrega detalles y especificaciones a tu tema editando la plantilla de tema."},"save_edit":"Guardar edición","overwrite_edit":"Sobrescribir edición","reply_original":"Responder en el tema original","reply_here":"Responder aquí","reply":"Responder","cancel":"Cancelar","create_topic":"Crear tema","create_pm":"Mensaje","create_whisper":"Susurrar","create_shared_draft":"Crear borrador compartido","edit_shared_draft":"Editar borrador compartido","title":"O pulsa Ctrl+Intro","users_placeholder":"Añadir un usuario","title_placeholder":"En una frase breve, ¿de qué trata este tema?","title_or_link_placeholder":"Escribe un título o pega un enlace aquí","edit_reason_placeholder":"¿Por qué lo estás editando?","topic_featured_link_placeholder":"Ingresa el enlace mostrado con el título.","remove_featured_link":"Eliminar enlace del tema.","reply_placeholder":"Escribe aquí. Usa Markdown, BBCode o HTML para darle formato. Arrastra o pega imágenes.","reply_placeholder_no_images":"Escribe aquí. Usa Markdown, BBCode o HTML para darle formato.","reply_placeholder_choose_category":"Selecciona una categoría antes de escribir aquí.","view_new_post":"Ver tu publicación nueva.","saving":"Guardando","saved":"¡Guardado!","saved_draft":"Publica el borrador en progreso. Escribe para reanudar.","uploading":"Subiendo...","show_preview":"mostrar vista previa \u0026raquo;","hide_preview":"\u0026laquo; ocultar vista previa","quote_post_title":"Citar toda la publicación","bold_label":"B","bold_title":"Negrita","bold_text":"texto en negrita","italic_label":"I","italic_title":"Cursiva","italic_text":"Texto en cursiva","link_title":"Hipervínculo","link_description":"Ingresa la descripción del enlace aquí","link_dialog_title":"Insertar hipervínculo","link_optional_text":"título opcional","link_url_placeholder":"Copia una URL o escribe para buscar temas","quote_title":"Cita","quote_text":"Cita","code_title":"Texto preformateado","code_text":"texto preformateado con sangría de 4 espacios","paste_code_text":"escribe o pega el código aquí","upload_title":"Subir","upload_description":"Ingresa una descripción del archivo subido aquí","olist_title":"Lista numerada","ulist_title":"Lista con viñetas","list_item":"Lista de elementos","toggle_direction":"Alternar dirección","help":"Ayuda de edición con Markdown","collapse":"minimizar el panel de edición","open":"abrir el panel de composición","abandon":"cerrar el editor y descartar borrador","enter_fullscreen":"ingresar al editor en pantalla completa","exit_fullscreen":"salir del editor en pantalla completa","modal_ok":"OK","modal_cancel":"Cancelar","cant_send_pm":"Lo sentimos, no puedes enviar un mensaje a %{username}.","yourself_confirm":{"title":"¿Olvidaste añadir destinatarios?","body":"¡Vas a enviarte este mensaje solo a ti mismo!"},"admin_options_title":"Configuración opcional del administrador para este tema","composer_actions":{"reply":"Responder","draft":"Borrador","edit":"Editar","reply_to_post":{"label":"Responder a la publicación %{postNumber} de %{postUsername}","desc":"Responder a una publicación específica"},"reply_as_new_topic":{"label":"Responder como tema enlazado","desc":"Crear un nuevo tema enlazado a este tema","confirm":"Tienes un borrador de tema nuevo guardado. Este se sobrescribirá si creas un tema enlazado."},"reply_as_private_message":{"label":"Nuevo mensaje","desc":"Crear un nuevo mensaje personal"},"reply_to_topic":{"label":"Responder al tema","desc":"Responder al tema, no a una publicación en específico"},"toggle_whisper":{"label":"Mostrar/Ocultar Susurros","desc":"Los susurros son visibles solo para los miembros del staff"},"create_topic":{"label":"Crear tema"},"shared_draft":{"label":"Borrador compartido","desc":"Crea un borrador que solo será visible por el staff"},"toggle_topic_bump":{"label":"Alternar bump del tema","desc":"Responder sin alterar la fecha de última respuesta"}},"details_title":"Resumen","details_text":"Este texto estará oculto"},"notifications":{"tooltip":{"regular":{"one":"%{count} notificación sin leer","other":"{{count}} notificaciones no leídas"},"message":{"one":"%{count} mensaje sin leer","other":"{{count}} mensajes sin leer"},"high_priority":{"one":"%{count} notificación de alta prioridad sin leer","other":"%{count} notificaciones de alta prioridad sin leer"}},"title":"notificaciones por menciones a tu @nombre, respuestas a tus publicaciones y temas, mensajes, etc","none":"No se pudieron cargar las notificaciones en este momento.","empty":"No se encontraron notificaciones.","post_approved":"Tu publicación ha sido aprobada","reviewable_items":"elementos que requieren revisión","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} mas\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} y otros {{count}} \u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"le ha dado me gusta a {{count}} de tus mensajes","other":"le ha dado me gusta a {{count}} de tus publicaciones"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e aceptó tu invitación","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e movió {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Ganaste '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNuevo tema\u003c/span\u003e {{description}}","membership_request_accepted":"Membresía aceptada en «{{group_name}}»","membership_request_consolidated":"{{count}} solicitudes de membresía abiertas para '{{group_name}}'","group_message_summary":{"one":"{{count}} mensaje en tu bandeja de {{group_name}}","other":"{{count}} mensajes en tu bandeja de {{group_name}} "},"popup":{"mentioned":"{{username}} te mencionó en «{{topic}}» - {{site_title}}","group_mentioned":"{{username}} te mencionó en «{{topic}}» - {{site_title}}","quoted":"{{username}} te citó en «{{topic}}» - {{site_title}}","replied":"{{username}} te respondió en «{{topic}}» - {{site_title}}","posted":"{{username}} publicó en «{{topic}}» - {{site_title}}","private_message":"{{username}} te envió un mensaje personal en «{{topic}}» - {{site_title}}","linked":"{{username}} enlazó tu publicación desde «{{topic}}» - {{site_title}}","watching_first_post":"{{username}} creó un nuevo tema «{{topic}}» - {{site_title}}","confirm_title":"Notificaciones activadas - %{site_title}","confirm_body":"¡Éxito! Se han activado las notificaciones.","custom":"Notificación de {{username}} en %{site_title}"},"titles":{"mentioned":"mencionado","replied":"nueva respuesta","quoted":"citado","edited":"editado","liked":"nuevo me gusta","private_message":"nuevo mensaje privado","invited_to_private_message":"invitado a mensaje privado","invitee_accepted":"invitación aceptada","posted":"nueva publicación","moved_post":"publicación movida","linked":"enlazado","bookmark_reminder":"recordatorio de marcador","bookmark_reminder_with_name":"recordatorio de marcador - %{name}","granted_badge":"medalla concedida","invited_to_topic":"invitado al tema","group_mentioned":"grupo mencionado","group_message_summary":"nuevos mensajes grupales","watching_first_post":"nuevo tema","topic_reminder":"recordatorio de tema","liked_consolidated":"nuevos me gusta","post_approved":"publicación aprobada","membership_request_consolidated":"nuevas solicitudes de membresía"}},"upload_selector":{"title":"Agregar imagen","title_with_attachments":"Agregar una imagen o archivo","from_my_computer":"Desde mi dispositivo","from_the_web":"Desde la web","remote_tip":"enlace a la imagen","remote_tip_with_attachments":"enlace a imagen o archivo {{authorized_extensions}}","local_tip":"selecciona las imágenes de tu dispositivo","local_tip_with_attachments":"selecciona imágenes o archivos de tu dispositivo {{authorized_extensions}}","hint":"(también puedes arrastrarlos al editor para subirlos)","hint_for_supported_browsers":"puedes también arrastrar o pegar imágenes en el editor","uploading":"Subiendo","select_file":"Selecciona archivo","default_image_alt_text":"imagen"},"search":{"sort_by":"Ordenar por","relevance":"Relevancia","latest_post":"Publicación más reciente","latest_topic":"Tema más reciente","most_viewed":"Más visto","most_liked":"Más me gusta recibidos","select_all":"Seleccionar todo","clear_all":"Limpiar todo","too_short":"El término de búsqueda es demasiado corto.","result_count":{"one":"\u003cspan\u003e%{count} resultado para\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} resultados para\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"buscar temas, publicaciones, usuarios o categorías","full_page_title":"buscar temas o publicaciones","no_results":"No se encontró ningún resultado.","no_more_results":"No se encontraron más resultados.","searching":"Buscando ...","post_format":"#{{post_number}} de {{username}}","results_page":"Resultados de búsqueda de «{{term}}»","more_results":"Hay más resultados. Por favor, restringe los criterios de búsqueda.","cant_find":"¿No puedes encontrar lo que estás buscando?","start_new_topic":"¿Y si creas un nuevo tema?","or_search_google":"O prueba buscar a través de Google:","search_google":"Intenta buscar con Google:","search_google_button":"Google","search_google_title":"Busca en este sitio","context":{"user":"Buscar publicaciones de @{{username}}","category":"Buscar la categoría #{{category}}","tag":"Buscar la etiqueta #{{tag}} ","topic":"Buscar en este tema","private_messages":"Buscar en mensajes"},"advanced":{"title":"Búsqueda avanzada","posted_by":{"label":"Publicado por"},"in_category":{"label":"Categorizado"},"in_group":{"label":"En el grupo"},"with_badge":{"label":"Con la medalla"},"with_tags":{"label":"Etiquetado"},"filters":{"label":"Solo temas/mensajes que...","title":"coincide el título únicamente","likes":"me han gustado","posted":"he publicado en ellos","created":"Creado por mi","watching":"estoy vigilando","tracking":"estoy siguiendo","private":"en mis mensajes","bookmarks":"he guardado","first":"son la primera publicación","pinned":"son destacados","unpinned":"son no destacados","seen":"he leído","unseen":"no he leído","wiki":"son tipo wiki","images":"incluyen imágenes","all_tags":"todas las etiquetas anteriores"},"statuses":{"label":"Donde los temas","open":"están abiertos","closed":"están cerrados","public":"son públicos","archived":"están archivados","noreplies":"no tienen respuestas","single_user":"contienen un solo usuario"},"post":{"count":{"label":"Número mínimo de publicaciones"},"time":{"label":"Publicó","before":"antes de","after":"después de"}}}},"hamburger_menu":"ir a otra lista de temas o categoría","new_item":"nuevo","go_back":"volver","not_logged_in_user":"página de usuario con resumen de la actividad y preferencias actuales","current_user":"ir a tu página de usuario","view_all":"ver todo","topics":{"new_messages_marker":"última visita","bulk":{"select_all":"Seleccionar todos","clear_all":"Desmarcar todos","unlist_topics":"Hacer invisibles","relist_topics":"Hacer visibles de nuevo","reset_read":"Restablecer leídos","delete":"Eliminar temas","dismiss":"Descartar","dismiss_read":"Descartar todos los temas sin leer","dismiss_button":"Descartar...","dismiss_tooltip":"Descartar solamente las nuevas publicaciones o dejar de seguir los temas","also_dismiss_topics":"Dejar de seguir estos temas para que no aparezcan más en mis mensajes no leídos","dismiss_new":"Ignorar nuevos","toggle":"activar selección de temas en bloque","actions":"Acciones en bloque","change_category":"Cambiar categoría","close_topics":"Cerrar temas","archive_topics":"Archivar temas","notification_level":"Notificaciones","choose_new_category":"Elige la nueva categoría de los temas:","selected":{"one":"Has seleccionado \u003cb\u003e%{count}\u003c/b\u003e tema.","other":"Has seleccionado \u003cb\u003e{{count}}\u003c/b\u003e temas."},"change_tags":"Remplazar etiquetas","append_tags":"Agregar etiquetas","choose_new_tags":"Elige etiquetas nuevas para estos temas:","choose_append_tags":"Elegir etiquetas nuevas para agregar a estos temas:","changed_tags":"Las etiquetas de esos temas fueron cambiadas."},"none":{"unread":"No tienes temas no leídos.","new":"No tienes temas nuevos.","read":"Todavía no has leído ningún tema.","posted":"Todavía no has publicado en ningún tema.","latest":"No hay temas recientes. Qué pena.","bookmarks":"Todavía no tienes temas guardados en marcadores.","category":"No hay temas con la categoría {{category}}.","top":"No hay temas destacados.","educate":{"new":"\u003cp\u003eTus temas nuevos aparecen aquí.\u003c/p\u003e\u003cp\u003ePor defecto, los temas se consideran nuevos y mostrarán un indicador de \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enuevo\u003c/span\u003e si fueron creados en los últimos 2 días.\u003c/p\u003e\u003cp\u003eConfigura tus \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e para cambiar esto.\u003c/p\u003e","unread":"\u003cp\u003eTus temas sin leer aparecen aquí.\u003c/p\u003e\u003cp\u003ePor defecto, los temas se consideran sin leer y mostrarán contadores de publicaciones sin leer \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e si tu:\u003c/p\u003e\u003cul\u003e\u003cli\u003eCreaste el tema\u003c/li\u003e\u003cli\u003eRespondiste al tema\u003c/li\u003e\u003cli\u003eLeíste el tema por más de 4 minutos\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eO si has establecido específicamente el tema como seguido o vigilado a través del control de notificaciones al pie de cada tema.\u003c/p\u003e\u003cp\u003eConfigura tus \u003ca href=\"%{userPrefsUrl}\"\u003epreferencias\u003c/a\u003e para cambiar esto.\u003c/p\u003e"}},"bottom":{"latest":"No hay más temas recientes.","posted":"No hay más temas publicados.","read":"No hay más temas leídos.","new":"No hay más temas nuevos.","unread":"No hay más temas que no hayas leído.","category":"No hay más temas de la categoría {{category}}.","top":"No hay más temas destacados.","bookmarks":"No hay más temas guardados en marcadores."}},"topic":{"filter_to":{"one":"%{count} post en el tema","other":"{{count}} publicaciones en el tema"},"create":"Crear tema","create_long":"Crear un tema nuevo","open_draft":"Abrir borrador","private_message":"Comenzar un mensaje","archive_message":{"help":"Archivar mensaje","title":"Archivar"},"move_to_inbox":{"title":"Mover a la bandeja de entrada","help":"Restaurar mensaje a la bandeja de entrada"},"edit_message":{"help":"Editar la primera publicación del mensaje","title":"Editar Mensaje"},"defer":{"help":"Marcar como no leído","title":"Aplazar"},"feature_on_profile":{"help":"Añadir un enlace a este tema en tu tarjeta de usuario y perfil","title":"Destacar en el perfil"},"remove_from_profile":{"warning":"Tu perfil ya tiene un tema destacado. Si continúas, este tema remplazará el tema actual.","help":"Eliminar el enlace a este tema de tu perfil de usuario","title":"Eliminar del perfil"},"list":"Temas","new":"nuevo tema","unread":"sin leer","new_topics":{"one":"%{count} tema nuevo","other":"{{count}} temas nuevos"},"unread_topics":{"one":"%{count} tema sin leer","other":"{{count}} temas sin leer"},"title":"Tema","invalid_access":{"title":"Este tema es privado","description":"Lo sentimos, ¡no tienes acceso a este tema!","login_required":"Debes iniciar sesión para poder ver este tema."},"server_error":{"title":"No se pudo cargar el tema","description":"Lo sentimos, no pudimos cargar el tema. Posiblemente se debe a problemas de conexión. Por favor, inténtalo nuevamente más tarde. Si el problema persiste, por favor contáctanos."},"not_found":{"title":"Tema no encontrado","description":"Lo sentimos, no pudimos encontrar ese tema. ¿Tal vez fue eliminado por un moderador?"},"total_unread_posts":{"one":"tienes %{count} publicación sin leer en este tema","other":"tienes {{count}} publicaciones sin leer en este tema"},"unread_posts":{"one":"tienes %{count} post antiguo sin leer en este tema","other":"tienes {{count}} publicaciones antiguas sin leer en este tema"},"new_posts":{"one":"hay %{count} nuevo post en este tema desde la última vez que lo leíste","other":"hay {{count}} publicaciones nuevas en este tema desde la última vez que lo leíste"},"likes":{"one":"este tema le gusta a %{count} persona","other":"este tema les gusta a {{count}} personas"},"back_to_list":"Volver a la lista de temas","options":"Opciones del tema","show_links":"mostrar enlaces dentro de este tema","toggle_information":"activar/desactivar detalles del tema","read_more_in_category":"¿Quieres leer más? Consulta otros temas en {{catLink}} o {{latestLink}}.","read_more":"¿Quieres leer más? {{catLink}} o {{latestLink}}.","group_request":"Necesitas solicitar la membresía al grupo «{{name}}» para ver este tema","group_join":"Debes unirte al grupo «{{name}}» para ver este tema","group_request_sent":"Tu solicitud de membresía al grupo fue enviada. Se te informará cuando seas aceptado.","unread_indicator":"Ningún miembro ha leído todavía la última publicación de este tema.","browse_all_categories":"Ver todas las categorías","view_latest_topics":"ver los temas recientes","suggest_create_topic":"¿Por qué no creas un tema?","jump_reply_up":"saltar a la primera respuesta","jump_reply_down":"saltar a la última respuesta","deleted":"El tema ha sido eliminado","topic_status_update":{"title":"Temporizador de temas","save":"Configurar temporizador","num_of_hours":"Número de horas:","num_of_days":"Número de días:","remove":"Quitar temporizador","publish_to":"Publicar en:","when":"Cuando:","public_timer_types":"Temporizadores de temas","private_timer_types":"Temporizadores de tema del usuario","time_frame_required":"Por favor, selecciona un plazo"},"auto_update_input":{"none":"Selecciona el plazo","later_today":"Más tarde durante el día de hoy","tomorrow":"Mañana","later_this_week":"Esta misma semana","this_weekend":"Este fin de semana","next_week":"Próxima semana","two_weeks":"Dos semanas","next_month":"Próximo mes","two_months":"Dos meses","three_months":"Tres meses","four_months":"Cuatro meses","six_months":"Seis meses","one_year":"Un año","forever":"Para siempre","pick_date_and_time":"Selecciona fecha y horario","set_based_on_last_post":"Cerrar en función de la última publicación"},"publish_to_category":{"title":"Programar publicación"},"temp_open":{"title":"Abrir temporalmente"},"auto_reopen":{"title":"Abrir tema automaticamente"},"temp_close":{"title":"Cerrar temporalmente"},"auto_close":{"title":"Cerrar tema automaticamente","label":"Horas de cierre automático del tema:","error":"Por favor, ingresa un valor válido.","based_on_last_post":"No cerrar hasta que la última publicación en el tema tenga por lo menos esta antigüedad."},"auto_delete":{"title":"Eliminar tema automaticamente"},"auto_bump":{"title":"Hacer bump al tema automaticamente"},"reminder":{"title":"Recordarme"},"auto_delete_replies":{"title":"Eliminar respuestas automáticamente"},"status_update_notice":{"auto_open":"Este tema se abrirá automáticamente %{timeLeft}.","auto_close":"Este tema se cerrará automáticamente %{timeLeft}.","auto_publish_to_category":"Este tema se publicará en \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Este tema se cerrará %{duration} después de la última respuesta.","auto_delete":"Este tema se eliminará automáticamente %{timeLeft}.","auto_bump":"La fecha de este tema se actualizará %{timeLeft}.","auto_reminder":"Te recordaremos sobre este tema %{timeLeft}.","auto_delete_replies":"Las respuestas a este tema serán eliminadas automáticamente después de %{duration}."},"auto_close_title":"Configuración de cierre automático","auto_close_immediate":{"one":"El último post se publicó hace %{count} hora, por lo que el tema se cerrará inmediatamente.","other":"La última publicación se realizó hace %{count} horas, por lo que el tema se cerrará inmediatamente."},"timeline":{"back":"Volver","back_description":"Volver a la última publicación sin leer","replies_short":"%{current} / %{total}"},"progress":{"title":"avances","go_top":"arriba","go_bottom":"abajo","go":"ir","jump_bottom":"saltar a la última publicación","jump_prompt":"saltar a...","jump_prompt_of":"de %{count} publicaciones","jump_prompt_long":"Saltar a...","jump_bottom_with_number":"saltar a la publicación %{post_number}","jump_prompt_to_date":"hasta hoy","jump_prompt_or":"o","total":"total de publicaciones","current":"publicación actual"},"notifications":{"title":"cambiar la frecuencia con la que se te notifica acerca de este tema","reasons":{"mailing_list_mode":"El modo lista de correo se encuentra activado, por lo que se te notificarán las respuestas a este tema por correo electrónico.","3_10":"Recibirás notificaciones porque estás vigilando una etiqueta de este tema.","3_6":"Recibirás notificaciones porque estás vigilando esta categoría.","3_5":"Recibirás notificaciones porque has empezado a vigilar este tema automáticamente.","3_2":"Recibirás notificaciones porque estás vigilando este tema.","3_1":"Recibirás notificaciones porque creaste este tema.","3":"Recibirás notificaciones porque estás vigilando este tema.","2_8":"Verás el número de respuestas  nuevas porque estás siguiendo esta categoría.","2_4":"Verás el número de respuestas nuevas porque has publicado una respuesta en este tema.","2_2":"Verás el número de respuestas nuevas porque estás siguiendo este tema.","2":"Verás el número de respuestas nuevas porque has \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eleído este tema\u003c/a\u003e.","1_2":"Se te notificará si alguien menciona tu @nombre o te responde.","1":"Se te notificará si alguien menciona tu @nombre o te responde.","0_7":"Estás ignorando todas las notificaciones en esta categoría.","0_2":"Estás ignorando todas las notificaciones en este tema.","0":"Estás ignorando todas las notificaciones en este tema."},"watching_pm":{"title":"Vigilar","description":"Se te notificará de cada publicación nueva en este mensaje y se mostrará el número de publicaciones nuevas."},"watching":{"title":"Vigilar","description":"Se te notificará de cada publicación nueva en este tema y se mostrará el número de publicaciones nuevas."},"tracking_pm":{"title":"Seguir","description":"Se mostrará el número de respuestas nuevas a este mensaje y se te notificará si alguien menciona tu @nombre o te responde."},"tracking":{"title":"Seguir","description":"Se mostrará el número de respuestas nuevas en este tema. Se te notificará si alguien menciona tu @nombre o te responde."},"regular":{"title":"Normal","description":"Se te notificará solo si alguien menciona tu @nombre o te responde."},"regular_pm":{"title":"Normal","description":"Se te notificará solo si alguien menciona tu @nombre o te responde."},"muted_pm":{"title":"Silenciar","description":"No recibirás ninguna notificación de este mensaje."},"muted":{"title":"Silenciar","description":"No recibirás ninguna notificación de este tema y no aparecerá en temas recientes."}},"actions":{"title":"Acciones","recover":"Deshacer eliminar tema","delete":"Eliminar tema","open":"Abrir tema","close":"Cerrar tema","multi_select":"Seleccionar publicaciones...","timed_update":"Configurar temporizador de temas...","pin":"Destacar tema...","unpin":"Dejar de destacar...","unarchive":"Desarchivar tema","archive":"Archivar tema","invisible":"Hacer invisible","visible":"Hacer visible","reset_read":"Restablecer datos de lectura","make_public":"Convertir en tema público","make_private":"Crear mensaje personal","reset_bump_date":"Resetear fecha de bump"},"feature":{"pin":"Destacar tema","unpin":"Dejar de destacar tema","pin_globally":"Destacar tema globalmente","make_banner":"Tema de encabezado","remove_banner":"Quitar tema de encabezado"},"reply":{"title":"Responder","help":"comienza a escribir un mensaje en este tema"},"clear_pin":{"title":"Eliminar destacado","help":"Dejar de descatar este tema para que no aparezca más de primero en tu lista de temas"},"share":{"title":"Compartir","extended_title":"Compartir un enlace","help":"comparte el enlace a este tema"},"print":{"title":"Imprimir","help":"Abrir una versión imprimible de este tema"},"flag_topic":{"title":"Reportar","help":"reportar de forma privada que se requiere atención o enviar una notificación privada","success_message":"Has reportado este tema correctamente."},"make_public":{"title":"Convertir en tema público","choose_category":"Por favor, elige una categoría para el tema público:"},"feature_topic":{"title":"Características de este tema","pin":"Hacer que este tema aparezca de primero en la categoría {{categoryLink}} hasta","confirm_pin":"Ya has destacado {{count}} temas. Que haya demasiados temas destacados puede resultar engorroso para los usuarios nuevos y anónimos. ¿Estás seguro de que quieres destacar otro tema en esta categoría?","unpin":"Quitar este tema del principio de la lista en la categoría {{categoryLink}}.","unpin_until":"Quitar este tema del top de la categoría {{categoryLink}} o esperar al \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Los usuarios pueden dejar de destacar los temas de forma individual por sí mismos.","pin_validation":"Es obligatorio especificar una fecha para destacar este tema.","not_pinned":"No hay temas destacados en {{categoryLink}}.","already_pinned":{"one":"Hay \u003cstrong class='badge badge-notification unread'\u003eun tema\u003c/strong\u003e destacado actualmente en {{categoryLink}}. ","other":"Temas destacados actualmente en {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Hacer que este tema aparezca de primero en todas las listas de temas hasta","confirm_pin_globally":"Ya has destacado {{count}} temas globalmente. Que haya demasiados temas destacados puede resultar engorroso para los usuarios nuevos y anónimos. ¿Estás seguro de que quieres destacar otro tema de forma global?","unpin_globally":"Quitar este tema de la parte superior de todas las listas de temas.","unpin_globally_until":"Quitar este tema de la parte superior de todas las listas de temas o esperar hasta \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Los usuarios pueden dejar de destacar el tema de forma individual por sí mismos.","not_pinned_globally":"No hay temas destacados globalmente.","already_pinned_globally":{"one":"Actualmente hay \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e tema destacado globalmente.","other":"Temas destacados globalmente: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Hacer que este tema aparezca como encabezado en la parte superior de todas las páginas.","remove_banner":"Retire el encabezado que aparece en la parte superior de todas las páginas.","banner_note":"Los usuarios pueden cerrar el encabezado y descartarlo. Solo se puede anunciar un tema a la vez.","no_banner_exists":"No hay ningún tema como encabezado.","banner_exists":"Actualmente \u003cstrong class='badge badge-notification unread'\u003ehay\u003c/strong\u003e un tema como encabezado."},"inviting":"Invitando...","automatically_add_to_groups":"Esta invitación incluye además acceso a los siguientes grupos:","invite_private":{"title":"Invitar al mensaje","email_or_username":"Correo electrónico o nombre de usuario del invitado","email_or_username_placeholder":"correo electrónico o nombre de usuario","action":"Invitar","success":"Hemos invitado a ese usuario a participar en este mensaje.","success_group":"Hemos invitado a ese grupo a participar en este mensaje.","error":"Lo sentimos, se produjo un error al invitar a ese usuario.","group_name":"nombre del grupo"},"controls":"Controles del tema","invite_reply":{"title":"Invitar","username_placeholder":"nombre de usuario","action":"Enviar invitación","help":"invitar a otros a este tema mediante correo electrónico o notificaciones","to_forum":"Enviaremos un correo electrónico breve con un enlace que le que permitirá a tu amigo unirse inmediatamente, sin necesidad de iniciar sesión.","sso_enabled":"ingresa el nombre de usuario de la persona a la que quieres invitar a este tema.","to_topic_blank":"Ingresa el nombre de usuario o correo electrónico de la persona que desea invitar a este tema.","to_topic_email":"Ingresaste una dirección de correo electrónico. Nosotros enviaremos una invitación a tu amigo que le permitirá responder inmediatamente a este tema.","to_topic_username":"Ingresaste un nombre de usuario. Le enviaremos una notificación con un enlace de invitación a este tema.","to_username":"Ingresa el nombre de usuario de la persona a la que quieres invitar. Le enviaremos una notificación con un enlace de invitación a este tema.","email_placeholder":"nombre@ejemplo.com","success_email":"Hemos enviado una invitación por correo electrónico a \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Te notificaremos cuando esta invitación sea aceptada. Puedes consultar el estado de tus invitaciones en las pestaña «Invitaciones» en tu perfil de usuario.","success_username":" Hemos invitado a ese usuario a participar en este tema.","error":"Lo sentimos, no pudimos invitar a esa persona. ¿Tal vez ya fue invitada antes? (El número de invitaciones es limitado)","success_existing_email":"Ya existe un usuario con el correo \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Invitamos a ese usuario a participar en este tema."},"login_reply":"Inicia sesión para responder","filters":{"n_posts":{"one":"%{count} post","other":"{{count}} publicaciones"},"cancel":"Quitar filtro"},"move_to":{"title":"Mover a","action":"mover a","error":"Se produjo un error al mover los mensajes."},"split_topic":{"title":"Mover a un tema nuevo","action":"mover a un tema nuevo","topic_name":"Título del tema nuevo","radio_label":"Tema nuevo","error":"Se produjo un error al mover las publicaciones al nuevo tema","instructions":{"one":"Estas a punto de crear un tema nuevo y rellenarlo con el post que has seleccionado.","other":"Estas a punto de crear un tema nuevo y rellenarlo con las \u003cb\u003e{{count}}\u003c/b\u003e publiacaciones que seleccionaste."}},"merge_topic":{"title":"Mover a un tema existente","action":"mover a un tema existente","error":"Se produjo un error al mover las publicaciones a ese tema","radio_label":"Tema existente","instructions":{"one":"Por favor escoge el tema al que quieres mover ese post.","other":"Por favor, escoge el tema al que quieres mover estas \u003cb\u003e{{count}}\u003c/b\u003e publicaciones."}},"move_to_new_message":{"title":"Mover a un mensaje nuevo","action":"mover a un mensaje nuevo","message_title":"Título del mensaje nuevo","radio_label":"Mnesaje nuevo","participants":"Participantes","instructions":{"one":"Estás a punto de crear un nuevo mensaje y de llenarlo con el mensaje que has seleccionado.","other":"Estás a punto de crear un mensaje nuevo y llenarlo con los \u003cb\u003e{{count}}\u003c/b\u003e mensajes seleccionados."}},"move_to_existing_message":{"title":"Mover a un mensaje existente","action":"mover a un mensaje existente","radio_label":"Mensaje existente","participants":"Participantes","instructions":{"one":"Por favor, selecciona el mensaje al que te gustaría mover el mensaje.","other":"Por favor, selecciona el mensaje al que te gustaría mover los \u003cb\u003e{{count}}\u003c/b\u003e mensajes."}},"merge_posts":{"title":"Fusionar las publicaciones seleccionadas","action":"fusionar las publicaciones seleccionadas","error":"Se produjo un error al fusionar las oublicaciones seleccionadas."},"publish_page":{"title":"Publicación de página","publish":"Publicar","description":"Cuando un tema se publica como página su URL se puede compartir y se mostrará con estilos personalizados.","slug":"Slug","publish_url":"La página se ha publicado en:","topic_published":"El tema se ha publicado en:","preview_url":"La página será publicada en:","invalid_slug":"Lo sentimos, no puedes publicar esta página.","unpublish":"Despublicar","unpublished":"La página se ha despublicado y ya no se puede acceder a ella.","publishing_settings":"Ajustes de publicación"},"change_owner":{"title":"Cambiar dueño","action":"cambiar dueño","error":"Se produjo un error al cambiar la autoría de las publicaciones.","placeholder":"nombre de usuario del nuevo dueño","instructions":{"one":"Por favor escoge el nuevo dueño del post de \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Por favor, escoge el nuevo dueño de las {{count}} publicaciones de \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Por favor, escoge un nuevo propietario para la publicación.","other":"Por favor, escoge un nuevo propietario para las {{count}} publicaciones"}},"change_timestamp":{"title":"Cambiar marca horaria...","action":"cambiar marca horaria","invalid_timestamp":"La marca horaria no puede ser en el futuro","error":"Hubo un error al cambiar la marca horaria de este tema.","instructions":"Por favor, selecciona la nueva marca horaria del tema. Las publicaciones en el tema se actualizarán para mantener la diferencia de tiempo."},"multi_select":{"select":"seleccionar","selected":"seleccionados ({{count}})","select_post":{"label":"seleccionar","title":"Agregar publicación a la selección"},"selected_post":{"label":"seleccionado","title":"Haz clic para quitar publicaciones de la selección"},"select_replies":{"label":"seleccionar +respuestas","title":"Agregar publicación y todas sus respuestas a la selección"},"select_below":{"label":"seleccionar +abajo","title":"Agregar publicación y todo lo que le sigue a la selección"},"delete":"eliminar selección","cancel":"cancelar selección","select_all":"seleccionar todo","deselect_all":"deshacer seleccionar todo","description":{"one":"Has seleccionado \u003cb\u003e%{count}\u003c/b\u003e post.","other":"Has seleccionado \u003cb\u003e{{count}}\u003c/b\u003e publicaciones."}},"deleted_by_author":{"one":"(tema retirado por su autor, se borrará automáticamente en %{count} hora, salvo que sea reportado)","other":"(tema retirado por el autor, se eliminará automáticamente en %{count} horas a menos de que sea reportado)"}},"post":{"quote_reply":"Citar","edit_reason":"Motivo:","post_number":"publicación {{number}}","ignored":"Contenido ignorado","wiki_last_edited_on":"wiki editada por última vez el","last_edited_on":"publicación editada por última vez el","reply_as_new_topic":"Responder como tema enlazado","reply_as_new_private_message":"Responder como mensaje nuevo a los mismos destinatarios","continue_discussion":"Continuando la discusión desde {{postLink}}:","follow_quote":"ir a la publicación citada","show_full":"Mostrar la publicación completa","show_hidden":"Ver contenido ignorado.","deleted_by_author":{"one":"(post retirado por el autor. Será borrado automáticamente en %{count} hora si no es reportado)","other":"(publicación retirada por el autor, se eliminará automáticamente en %{count} horas a menos de que sea reportada)"},"collapse":"contraer","expand_collapse":"expandir/contraer","locked":"un miembro del staff bloqueó la posibilidad de editar esta publicación","gap":{"one":"ver %{count} post oculto","other":"ver {{count}} publicaciones ocultas"},"notice":{"new_user":"Esta es la primera vez que {{user}} ha publicado — ¡démosle la bienvenida a nuestra comunidad!","returning_user":"Hace tiempo que no vemos a {{user}} — su última publicación fue {{time}}. "},"unread":"Publicaciones sin leer","has_replies":{"one":"{{count}} Respuesta","other":"{{count}} Respuestas"},"has_likes_title":{"one":"%{count} persona le ha dado Me gusta a este post","other":"{{count}} personas le han dado me gusta a esta publicación"},"has_likes_title_only_you":"te ha gustado este mensaje","has_likes_title_you":{"one":"A tí y a una persona le ha gustado este mensaje","other":"A tí y a otros {{count}} les han gustado este mensaje"},"errors":{"create":"Lo sentimos, se produjo un error al crear tu publicación. Por favor, inténtalo de nuevo.","edit":"Lo sentimos, se produjo un error al editar tu publicación. Por favor, inténtalo de nuevo.","upload":"Lo sentimos, se produjo un error al subir este archivo. Por favor, inténtalo de nuevo.","file_too_large":"Lo sentimos, ese archivo es demasiado grande (el tamaño máximo es {{max_size_kb}} kb). ¿Por qué no lo subes a un servicio de almacenamiento en la nube y compartes el enlace luego?","too_many_uploads":"Lo sentimos, solo puedes subir un archivo a la vez.","too_many_dragged_and_dropped_files":"Lo sentimos, solo puedes subir {{max}} archivos a la vez.","upload_not_authorized":"Lo sentimos, el archivo que estás intentando subir no está permitido (extensiones autorizadas: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Lo sentimos, los usuarios nuevos no pueden subir imágenes.","attachment_upload_not_allowed_for_new_user":"Lo sentimos, los usuarios nuevos no pueden subir archivos adjuntos.","attachment_download_requires_login":"Lo sentimos, necesitas haber iniciado sesión para descargar archivos adjuntos."},"abandon_edit":{"confirm":"¿Estás seguro de que quieres descartar tus cambios?","no_value":"No, permanecer","no_save_draft":"No, guardar borrador","yes_value":"Sí, descartar edición"},"abandon":{"confirm":"¿Estás seguro de que deseas abandonar tu publicación?","no_value":"No, permanecer","no_save_draft":"No, guardar borrador","yes_value":"Sí, abandonar"},"via_email":"esta publicación llegó por correo electrónico","via_auto_generated_email":"esta publicación llegó a través de un correo electrónico generado automáticamente","whisper":"esta publicación es un susurro privado para los moderadores","wiki":{"about":"esta publicación tiene formato wiki"},"archetypes":{"save":"Guardar opciones"},"few_likes_left":"¡Gracias por compartir amor! Solo te quedan unos pocos me gusta por hoy.","controls":{"reply":"crear una respuesta a esta publicación","like":"me gusta esta publicación","has_liked":"te gusta esta publicación","read_indicator":"miembros que han leído esta publicación","undo_like":"deshacer me gusta","edit":"editar esta publicación","edit_action":"Editar","edit_anonymous":"Lo sentimos, necesitas iniciar sesión para editar esta publicación.","flag":"reporta esta publicación de forma privada para llamar la atención de los moderadores o enviarles un notificación privada sobre el tema","delete":"eliminar este publicación","undelete":"deshacer la eliminación de esta publicación","share":"comparte un enlace a esta publicación","more":"Más","delete_replies":{"confirm":"¿Quieres eliminar también las respuestas a esta publicación?","direct_replies":{"one":"Si, y %{count} respuesta directa","other":"Sí, y las {{count}} respuestas directas"},"all_replies":{"one":"Sí, y %{count} respuesta","other":"Sí, y todas las {{count}} respuestas"},"just_the_post":"No, solo esta publicación"},"admin":"acciones de administrador para la publicación","wiki":"Transformar en formato wiki","unwiki":"Deshacer formato wiki","convert_to_moderator":"Convertir en publicación del staff","revert_to_regular":"Revertir el formato de publicación del staff","rebake":"Reconstruir HTML","publish_page":"Publicación de página","unhide":"Deshacer ocultar","change_owner":"Cambiar dueño","grant_badge":"Conceder medalla","lock_post":"Bloquear publicación","lock_post_description":"impedir que el usuario que realizó esta publicación la edite","unlock_post":"Desbloquear publicación","unlock_post_description":"permitir que el usuario que realizó esta publicación la edite","delete_topic_disallowed_modal":"No tienes permiso para eliminar este tema. Si de verdad quieres que se elimine, repórtalo y explica tus motivos a los moderadores.","delete_topic_disallowed":"no tienes permiso para eliminar este tema","delete_topic":"eliminar tema","add_post_notice":"Añadir aviso del staff","remove_post_notice":"Eliminar aviso del staff","remove_timer":"quitar temporizador"},"actions":{"flag":"Reportar","defer_flags":{"one":"Ignorar reporte","other":"Ignorar reportes"},"undo":{"off_topic":"Deshacer reporte","spam":"Deshacer reporte","inappropriate":"Deshacer reporte","bookmark":"Deshacer marcador","like":"Deshacer me gusta"},"people":{"off_topic":"reportó esto como sin relación con el tema","spam":"reportó esto como spam","inappropriate":"reportó esto como inapropiado","notify_moderators":"notificó a moderadores","notify_user":"envió un mensaje","bookmark":"guardó esto en marcadores","like":{"one":"le dio me gusta a esto","other":"le dieron me gusta a esto"},"read":{"one":"leyó esto","other":"leyeron esto"},"like_capped":{"one":"y {{count}} otro le gustó esto","other":"y {{count}} otros le dieron me gusta a esto"},"read_capped":{"one":"y {{count}} otro ha leído","other":"y {{count}} otros han leído"}},"by_you":{"off_topic":"Reportaste esto como sin relación con el tema","spam":"Reportaste esto como spam","inappropriate":"Reportaste esto como inapropiado","notify_moderators":"Reportaste esto para que sea atendido por un moderador","notify_user":"Enviaste un mensaje a este usuario","bookmark":"Guardaste esta publicación en marcadores","like":"Te gustó esto"}},"delete":{"confirm":{"one":"¿Estás seguro que quieres eliminar ese post?","other":"¿Estás seguro de que quieres eliminar estas {{count}} publicaciones?"}},"merge":{"confirm":{"one":"Seguro que quieres unir esos posts?","other":"¿Estás seguro de que quieres fusionar estas {{count}} publicaciones?"}},"revisions":{"controls":{"first":"Primera revisión","previous":"Revisión anterior","next":"Siguiente revisión","last":"Última revisión","hide":"Ocultar revisión.","show":"Mostrar revisión.","revert":"Volver a esta revisión","edit_wiki":"Editar wiki","edit_post":"Editar publicación","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Mostrar la producción renderizada con adiciones y eleminaciones en línea","button":"HTML"},"side_by_side":{"title":"Mostrar las differencias con la producción renderizada lado a lado","button":"HTML"},"side_by_side_markdown":{"title":"Mostrar las diferencias con la fuente sin procesar","button":"Sin procesar"}}},"raw_email":{"displays":{"raw":{"title":"Mostrar correos electrónicos sin procesar","button":"Sin procesar"},"text_part":{"title":"Mostrar la parte del texto del correo electrónico","button":"Texto"},"html_part":{"title":"Mostrar la parte HTML del correo electrónico","button":"HTML"}}},"bookmarks":{"create":"Crear marcador","edit":"Editar marcador","created":"Creado","name":"Nombre","name_placeholder":"¿Para qué es este marcador?","set_reminder":"Recuérdame","actions":{"delete_bookmark":{"name":"Eliminar marcador","description":"Elimina el marcador de tu perfil y cancela todos los recordatorios para tal marcador"},"edit_bookmark":{"name":"Editar marcador","description":"Editar el nombre del marcador o cambia la fecha y hora del recordatorio"}}}},"category":{"can":"puede\u0026hellip; ","none":"(sin categoría)","all":"Todas las categorías","choose":"categoría\u0026hellip;","edit":"Editar","edit_dialog_title":"Editar: %{categoryName}","view":"Ver temas en la categoría","general":"General","settings":"Ajustes","topic_template":"Plantilla de tema","tags":"Etiquetas","tags_allowed_tags":"Restringir estas etiquetas a esta categoría:","tags_allowed_tag_groups":"Restringir estos grupos de etiquetas a esta categoría:","tags_placeholder":"(Opcional) lista de etiquetas permitidas","tags_tab_description":"Las etiquetas y grupos de etiquetas arriba especificados solo estarán disponibles en esta categoría y en las otras categorías que igualmente lo especifiquen. No se permitirá su uso en otras categorías.","tag_groups_placeholder":"(Opcional) lista de grupos de etiquetas permitidos","manage_tag_groups_link":"Gestiona los grupos de etiquetas aquí.","allow_global_tags_label":"Permitir también otras etiquetas","tag_group_selector_placeholder":"(Opcional) Grupo de etiquetas","required_tag_group_description":"Requerir que los nuevos temas tengan etiquetas de un grupo de etiquetas:","min_tags_from_required_group_label":"Número de etiquetas:","required_tag_group_label":"Grupo de etiquetas:","topic_featured_link_allowed":"Permitir enlaces destacados en esta categoría","delete":"Eliminar categoría","create":"Crear categoría","create_long":"Crear una nueva categoría","save":"Guardar categoría","slug":"Slug de la categoría para URL","slug_placeholder":"(Opcional) palabras-separadas-por-guiones para URL","creation_error":"Se produjo un error al crear la categoría.","save_error":"Se produjo un error al guardar la categoría","name":"Nombre de la categoría","description":"Descripción","topic":"tema de la categoría","logo":"Imagen (logo) para la categoría","background_image":"Imagen de fondo de la categoría","badge_colors":"Colores de las medallas","background_color":"Color de fondo","foreground_color":"Colores de primer plano","name_placeholder":"Una o dos palabras máximo","color_placeholder":"Cualquier color web","delete_confirm":"¿Estás seguro de que quieres eliminar esta categoría?","delete_error":"Se produjo un error al eliminar la categoría.","list":"Lista de categorías","no_description":"Por favor, agrega una descripción para esta categoría.","change_in_category_topic":"Editar descripción","already_used":"Este color ya ha sido usado para otra categoría","security":"Seguridad","special_warning":"Aviso: esta categoría se ajusta por defecto y las opciones de seguridad no pueden ser editadas. Si no deseas utilizarla, elimínala en vez de reutilizarla.","uncategorized_security_warning":"Esta categoría es especial: se usa para temas que no tienen una categoría asignada y y no puede tener ajustes de seguridad.","uncategorized_general_warning":"Esta categoría es especial. Se utiliza como la categoría predeterminada para los temas nuevos que no tienen una categoría seleccionada. Si deseas evitar este comportamiento y forzar la selección de categorías, \u003ca href=\"%{settingLink}\"\u003epor favor, desactiva la opción aquí\u003c/a\u003e. Si deseas cambiar el nombre o la descripción, ve a \u003ca href=\"%{customizeLink}\"\u003ePersonalizar / Contenido de texto\u003c/a\u003e.","pending_permission_change_alert":"No has agregado a %{group} a esta categoría. Haz clic en este botón para agregarlos.","images":"Imágenes","email_in":"Dirección de correo electrónico personalizada para el correo entrante:","email_in_allow_strangers":"Aceptar correo electrónicos de usuarios anónimos sin cuenta","email_in_disabled":"La posibilidad de publicar temas nuevos por correo electrónico está deshabilitada en los ajustes del sitio. Para habilitar la publicación de temas nuevos por correo electrónico,","email_in_disabled_click":"activa la opción «correo electrónico»","mailinglist_mirror":"La categoría es el reflejo de una lista de correo","show_subcategory_list":"Mostrar la lista de subcategorías arriba de la lista de temas en esta categoría.","num_featured_topics":"Número de temas que se muestran en la página de categorías:","subcategory_num_featured_topics":"Número de temas destacados a mostrar en la página principal de categorías:","all_topics_wiki":"Hacer que los temas nuevos tengan formato wiki por defecto","subcategory_list_style":"Estilo de lista de subcategorías:","sort_order":"Ordenar lista de temas:","default_view":"Orden por defecto:","default_top_period":"Período por defecto para estar en la parte superior:","allow_badges_label":"Permitir que se concedan medallas en esta categoría","edit_permissions":"Editar permisos","reviewable_by_group":"Además del staff, las publicaciones y los reportes en esta categoría también pueden ser revisados por:","review_group_name":"nombre del grupo","require_topic_approval":"Requiere aprobación del moderador para todos los temas nuevos","require_reply_approval":"Requiere aprobación del moderador para todas las respuestas nuevas","this_year":"este año","position":"Posición en la página de categorías:","default_position":"Posición predeterminada","position_disabled":"Las Categorías se mostrarán por orden de actividad. Para controlar el orden en que aparecen en las listas,","position_disabled_click":"activa la opción «posiciones de categoría fijas».","minimum_required_tags":"Número mínimo de etiquetas requeridas en un tema:","parent":"Categoría primaria","num_auto_bump_daily":"Número de temas abiertos a los que se le hará bump de diariamente de forma automática:","navigate_to_first_post_after_read":"Ir a la primera publicación después de haber leído los temas","notifications":{"watching":{"title":"Vigilar","description":"Vigilarás automáticamente todos los temas en estas categorías. Se te notificará de cada publicación nueva en cada tema y se mostrará un contador de respuestas nuevas."},"watching_first_post":{"title":"Vigilar la primera publicación","description":"Se te notificará acerca de los temas nuevos en esta categoría, pero no cuando haya respuestas nuevas a los temas."},"tracking":{"title":"Seguir","description":"Seguirás automáticamente todos los temas en estas categorías. Se te notificará si alguien menciona tu @nombre o te responde y se mostrará un contador de respuestas nuevas."},"regular":{"title":"Normal","description":"Se te notificará solo si alguien menciona tu @nombre o te responde."},"muted":{"title":"Silenciar","description":"No se te notificará de ningún tema en estas categorías y no aparecerán en la página de mensajes recientes."}},"search_priority":{"label":"Prioridad de búsqueda","options":{"normal":"Normal","ignore":"Ignorar","very_low":"Muy baja","low":"Baja","high":"Alta","very_high":"Muy alta"}},"sort_options":{"default":"por defecto","likes":"Me gusta","op_likes":"Me gusta de la publicación original","views":"Visitas","posts":"Publicaciones","activity":"Actividad","posters":"Participantes","category":"Categoría","created":"Creado","votes":"Votos"},"sort_ascending":"Ascendente","sort_descending":"Descendente","subcategory_list_styles":{"rows":"Filas","rows_with_featured_topics":"Filas con temas destacados","boxes":"Cajas","boxes_with_featured_topics":"Cajas con temas destacados"},"settings_sections":{"general":"General","moderation":"Moderación","appearance":"Aspecto","email":"Correo electrónico"}},"flagging":{"title":"¡Gracias por ayudar a mantener una comunidad civilizada!","action":"Reportar publicación","take_action":"Tomar medidas","notify_action":"Mensaje","official_warning":"Advertencia oficial","delete_spammer":"Eliminar spammer","yes_delete_spammer":"Sí, eliminar spammer","ip_address_missing":"(N/D)","hidden_email_address":"(oculto)","submit_tooltip":"Enviar el reporte privado","take_action_tooltip":"Alcanzar el umbral de reportes inmediatamente en vez de esperar más reportes de la comunidad","cant":"Lo sentimos, no puedes reportar esta publicación en este momento.","notify_staff":"Notificar a los administradores de forma privada","formatted_name":{"off_topic":"No tiene relación con el tema","inappropriate":"Es inapropiado","spam":"Es spam"},"custom_placeholder_notify_user":"Sé específico, constructivo y siempre amable.","custom_placeholder_notify_moderators":"Haznos saber qué te preocupa específicamente y, siempre que sea posible, incluye enlaces y ejemplos relevantes.","custom_message":{"at_least":{"one":"introduce al menos %{count} caracteres","other":"ingresa al menos {{count}} caracteres"},"more":{"one":"%{count} más...","other":"{{count}} más..."},"left":{"one":"%{count} restante","other":"{{count}} restantes"}}},"flagging_topic":{"title":"¡Gracias por ayudar a mantener una comunidad civilizada!","action":"Reportar tema","notify_action":"Mensaje"},"topic_map":{"title":"Resumen de temas","participants_title":"Autores frecuentes","links_title":"Enlaces populares","links_shown":"mostrar más enlaces...","clicks":{"one":"%{count} clic","other":"%{count} clics"}},"post_links":{"about":"ver más enlaces de esta publicación","title":{"one":"%{count} más","other":"%{count} más"}},"topic_statuses":{"warning":{"help":"Ésta es una advertencia oficial."},"bookmarked":{"help":"Guardaste en marcadores este tema"},"locked":{"help":"Este tema está cerrado; ya no se aceptan respuestas nuevas"},"archived":{"help":"este tema está archivado; está congelado y no se puede cambiar"},"locked_and_archived":{"help":"este tema está cerrado y archivado; ya no acepta respuestas nuevas y no se puede cambiar"},"unpinned":{"title":"Dejar de destacar","help":"Este tema se ha dejado de destacar para ti; tu lista de temas se mostrará en orden normal"},"pinned_globally":{"title":"Destacado globalmente","help":"Este tema ha sido destacado globalmente, se mostrará en la parte superior de la página de mensajes recientes y de su categoría."},"pinned":{"title":"Destacado","help":"Este tema ha sido destacado para ti; se mostrará en la parte superior de su categoría"},"unlisted":{"help":"Este tema es invisible. No se mostrará en la lista de temas y solo se le puede acceder mediante un enlace directo"},"personal_message":{"title":"Este tema es un mensaje personal","help":"Este tema es un mensaje personal"}},"posts":"Publicaciones","posts_long":"Hay {{number}} publicaciones en este tema","original_post":"Publicación original","views":"Vistas","views_lowercase":{"one":"visita","other":"vistas"},"replies":"Respuestas","views_long":{"one":"este tema se ha visto %{count} vez","other":"este tema se ha visto {{number}} veces"},"activity":"Actividad","likes":"Me gusta","likes_lowercase":{"one":"me gusta","other":"me gusta"},"likes_long":"este tema tiene {{number}} me gusta","users":"Usuarios","users_lowercase":{"one":"usuario","other":"usuarios"},"category_title":"Categoría","history":"Historial","changed_by":"por {{author}}","raw_email":{"title":"Correo electrónicos entrantes","not_available":"¡No disponible!"},"categories_list":"Lista de categorías","filters":{"with_topics":"%{filter} temas","with_category":"%{filter} Foro de %{category}","latest":{"title":"Recientes","title_with_count":{"one":"Reciente (%{count})","other":"Recientes ({{count}})"},"help":"temas con publicaciones recientes"},"read":{"title":"Leídos","help":"temas que ya has leído en el orden que los leíste por última vez"},"categories":{"title":"Categorías","title_in":"Categoría - {{categoryName}}","help":"todos los temas agrupados por categoría"},"unread":{"title":"Sin leer","title_with_count":{"one":"Sin leer (%{count})","other":"Sin leer ({{count}})"},"help":"temas que estás vigilando o siguiendo actualmente con publicaciones sin leer","lower_title_with_count":{"one":"{{count}} sin leer","other":"{{count}} sin leer"}},"new":{"lower_title_with_count":{"one":"%{count} tema nuevo","other":"{{count}} nuevos"},"lower_title":"nuevo","title":"Nuevo","title_with_count":{"one":"Nuevos ({{count}})","other":"Nuevos ({{count}})"},"help":"temas creados en los últimos días"},"posted":{"title":"Mis publicaciones","help":"temas en los que has publicado"},"bookmarks":{"title":"Marcadores","help":"temas que has guardado en marcadores"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"temas recientes en la categoría {{categoryName}}"},"top":{"title":"Destacados","help":"los temas con más actividad en el último año, mes, semana o día","all":{"title":"Siempre"},"yearly":{"title":"Anualmente"},"quarterly":{"title":"Trimestralmente"},"monthly":{"title":"Mensualmente"},"weekly":{"title":"Semanalmente"},"daily":{"title":"Diariamente"},"all_time":"Siempre","this_year":"Año","this_quarter":"Trimestre","this_month":"Mes","this_week":"Semana","today":"Hoy","other_periods":"ver los destacados"},"votes":{"title":"Votos","help":"temas con más votos"}},"browser_update":"Desafortunadamente \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003etu navegador es demasiado antiguo para funcionar en este sitio\u003c/a\u003e. Por favor, \u003ca href=\"https://browsehappy.com\"\u003eactualiza tu navegador\u003c/a\u003e.","permission_types":{"full":"Crear / Responder / Ver","create_post":"Responder / Ver","readonly":"Ver"},"lightbox":{"download":"descargar","previous":"Anterior (flecha izquierda)","next":"Siguiente (flecha derecha)","counter":"%curr% de %total%","close":"Cerrar (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eEl contenido\u003c/a\u003e no se pudo cargar.","image_load_error":"\u003ca href=\"%url%\"\u003eLa imagen\u003c/a\u003e no se pudo cargar."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":",","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} o %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Atajos de teclado","jump_to":{"title":"Saltar a","home":"%{shortcut} Inicio","latest":"%{shortcut} Recientes","new":"%{shortcut} Nuevos","unread":"%{shortcut} Sin leer","categories":"%{shortcut} Categorías","top":"%{shortcut} Destacado","bookmarks":"%{shortcut} Marcadores","profile":"%{shortcut} Perfil","messages":"%{shortcut} Mensajes","drafts":"%{shortcut} Borradores"},"navigation":{"title":"Navegación","jump":"%{shortcut} Ir a la publicación #","back":"%{shortcut} Volver","up_down":"%{shortcut} Desplazar selección \u0026uarr; \u0026darr;","open":"%{shortcut} Abrir tema seleccionado","next_prev":"%{shortcut} Sección siguiente/anterior","go_to_unread_post":"%{shortcut} Ir a la primera publicación sin leer"},"application":{"title":"Aplicación","create":"%{shortcut} Crear un nuevo tema","notifications":"%{shortcut} Abrir notificaciones","hamburger_menu":"%{shortcut} Abrir menú hamburguesa","user_profile_menu":"%{shortcut} Abrir menú de usuario","show_incoming_updated_topics":"%{shortcut} Mostrar temas actualizados","search":"%{shortcut} Buscar","help":"%{shortcut} Abrir guía de atajos de teclado","dismiss_new_posts":"%{shortcut} Descartar publicaciones nuevas","dismiss_topics":"%{shortcut} Descartar temas","log_out":"%{shortcut} Cerrar sesión"},"composing":{"title":"Redactando","return":"%{shortcut} Regresar al editor","fullscreen":"%{shortcut} Edición en pantalla completa"},"bookmarks":{"title":"Marcadores","enter":"%{shortcut} Guardar y cerrar","later_today":"%{shortcut} Hoy más tarde","later_this_week":"%{shortcut} Esta semana","tomorrow":"%{shortcut} Mañana","next_week":"%{shortcut} La semana que viene","next_month":"%{shortcut} El mes que viene","next_business_week":"%{shortcut} Principio de la semana que viene","next_business_day":"%{shortcut} Siguiente día hábil","custom":"%{shortcut} Fecha y hora personalizadas","none":"%{shortcut} Sin recordatorio","delete":"%{shortcut} Borrar marcador"},"actions":{"title":"Acciones","bookmark_topic":"%{shortcut} Guardar/quitar el tema de marcadores","pin_unpin_topic":"%{shortcut} Destacar/dejar de destacar tema","share_topic":"%{shortcut} Compartir tema","share_post":"%{shortcut} Compartir publicación","reply_as_new_topic":"%{shortcut} Responder como un tema enlazado","reply_topic":"%{shortcut} Responder al tema","reply_post":"%{shortcut} Responder a la publicación","quote_post":"%{shortcut} Citar publicación","like":"%{shortcut} Me gusta la publicación","flag":"%{shortcut} Reportar publicación","bookmark":"%{shortcut} Guardar publicación en marcadores","edit":"%{shortcut} Editar publicación","delete":"%{shortcut} Eliminar publicación","mark_muted":"%{shortcut} Silenciar tema","mark_regular":"%{shortcut} Seguimiento normal del tema normal (por defecto)","mark_tracking":"%{shortcut} Seguir tema","mark_watching":"%{shortcut} Vigilar Tema","print":"%{shortcut} Imprimir tema","defer":"%{shortcut} Aplazar el tema","topic_admin_actions":"%{shortcut} Abrir acciones de administrador del tema"},"search_menu":{"title":"Buscar Menu","prev_next":"%{shortcut} Mover selección arriba y abajo","insert_url":"%{shortcut} Insertar selección dentro del editor abierto"}},"badges":{"earned_n_times":{"one":"Ganó esta medalla %{count} vez","other":"Medalla ganada %{count} veces"},"granted_on":"Concedido hace %{date}","others_count":"Otras personas con esta medalla (%{count})","title":"Medallas","allow_title":"Puedes usar esta medalla como título","multiple_grant":"Puedes ganar esta medalla varias veces","badge_count":{"one":"%{count} medalla","other":"%{count} medallas"},"more_badges":{"one":"+%{count} Más","other":"+%{count} Más"},"granted":{"one":"%{count} concedido","other":"%{count} concedidas"},"select_badge_for_title":"Selecciona una medalla para utilizar como tu título","none":"(ninguna)","successfully_granted":"%{badge} concedida exitosamente a %{username}","badge_grouping":{"getting_started":{"name":"Guía de inicio"},"community":{"name":"Comunidad"},"trust_level":{"name":"Nivel de confianza"},"other":{"name":"Miscelánea"},"posting":{"name":"Publicación"}}},"tagging":{"all_tags":"Todas las etiquetas","other_tags":"Otras etiquetas","selector_all_tags":"todas las etiquetas","selector_no_tags":"sin etiquetas","changed":"etiquetas cambiadas:","tags":"Etiquetas","choose_for_topic":"etiquetas opcionales","info":"Info","default_info":"Esta etiqueta no está restringida a ninguna categoría, y no tiene sinónimos.","category_restricted":"Esta etiqueta está restringida para las categorías a las que no tienes permiso de acceso.","synonyms":"Sinónimos","synonyms_description":"Cuando las siguientes etiquetas sean usadas, serán reemplazadas por \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"Esta etiqueta pertence al grupo: «{{tag_groups}}»","other":"Esta etiqueta pertence a estos grupos: {{tag_groups}}."},"category_restrictions":{"one":"Solo se puede utilizar en esta categoría:","other":"Solo se puede utilizar en estas categorías:"},"edit_synonyms":"Gestionar sinónimos","add_synonyms_label":"Añadir sinónimos:","add_synonyms":"Añadir","add_synonyms_explanation":{"one":"Se cambiarán la etiqueta en cualquier sitio que esté en uso, sustituyéndose por \u003cb\u003e%{tag_name}\u003c/b\u003e en su lugar. ¿Seguro que quieres hacer el cambio?","other":"Se cambiarán las etiquetas en todos los lugares en los que estén en uso y se sustituirán por \u003cb\u003e%{tag_name}\u003c/b\u003e en su lugar. ¿Seguro de que quieres hacer este cambio?"},"add_synonyms_failed":"No se han podido añadir las siguientes etiquetas como sinónimos: \u003cb\u003e%{tag_names}\u003c/b\u003e. Asegúrate de que no tienen sinónimos y de que no son sinónimos de otra etiqueta.","remove_synonym":"Quitar sinónimo","delete_synonym_confirm":"¿Estás seguro de que quieres eliminar el sinónimo «%{tag_name}»?","delete_tag":"Eliminar etiqueta","delete_confirm":{"one":"¿Estás seguro de querer borrar esta etiqueta y eliminarla de %{count} tema asignado?","other":"¿Estás seguro de que quieres eliminar esta etiqueta y quitarla de los {{count}} temas a los que está asignada?"},"delete_confirm_no_topics":"¿Estás seguro de que quieres eliminar esta etiqueta?","delete_confirm_synonyms":{"one":"Su sinónimo también se eliminará","other":"Sus {{count}} sinónimos también se eliminarán."},"rename_tag":"Renombrar etiqueta","rename_instructions":"Elige un nuevo nombre para la etiqueta:","sort_by":"Ordenar por:","sort_by_count":"contador","sort_by_name":"nombre","manage_groups":"Administrar grupos de etiquetas","manage_groups_description":"Definir grupos para organizar etiquetas","upload":"Subir etiquetas","upload_description":"Sube un archivo csv para crear etiquetas en masa","upload_instructions":"Una por línea, opcional con un grupo de etiquetas en el formato «tag_name,tag_group».","upload_successful":"Etiquetas subidas con éxito","delete_unused_confirmation":{"one":"%{count} etiqueta será eliminada: %{tags}","other":"%{count} etiquetas serán eliminadas: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} y %{count} más","other":"%{tags} y %{count} más"},"delete_unused":"Eliminar etiquetas sin usar","delete_unused_description":"Eliminar todas las etiquetas que no estén asociadas a ningún tema o mensaje personal","cancel_delete_unused":"Cancelar","filters":{"without_category":"%{filter} %{tag} temas","with_category":"%{filter} %{tag} temas en %{category}","untagged_without_category":"%{filter} temas sin etiquetas","untagged_with_category":"%{filter} temas sin etiquetas en %{category}"},"notifications":{"watching":{"title":"Vigilar","description":"Vigilarás automáticamente todos los temas con esta etiqueta. Se te notificarán todos los temas y publicaciones nuevas. Además aparecerá un contador de publicaciones nuevas y sin leer al lado del tema."},"watching_first_post":{"title":"Vigilar primera publicación","description":"Se te notificará acerca de nuevos temas con esta etiqueta, pero no cuando haya respuestas al tema."},"tracking":{"title":"Seguir","description":"Seguirás automáticamente todos los temas con esta etiqueta. Aparecerá un contador de publicaciones nuevas y sin leer al lado del tema."},"regular":{"title":"Normal","description":"Se te notificará si alguien menciona tu @nombre o responde a alguna de tus publicaciones."},"muted":{"title":"Silenciado","description":"No se te notificará sobre temas nuevos con esta etiqueta, ni aparecerán en tu pestaña de no leídos."}},"groups":{"title":"Grupos de etiquetas","about":"Agrupar etiquetas para administrarlas más fácilmente.","new":"Nuevo grupo","tags_label":"Etiquetas en este grupo:","tags_placeholder":"etiquetas","parent_tag_label":"Etiqueta primaria:","parent_tag_placeholder":"Opcional","parent_tag_description":"Las etiquetas de este grupo no se pueden utilizar a menos que la etiqueta primaria esté presente. ","one_per_topic_label":"Limitar las etiquetas de este grupo a utilizarse solo una vez por tema","new_name":"Nuevo grupo de etiquetas","name_placeholder":"Nombre del grupo de etiquetas","save":"Guardar","delete":"Eliminar","confirm_delete":"¿Estás seguro de que quieres eliminar este grupo de etiquetas?","everyone_can_use":"Todos pueden utilizar las etiquetas","usable_only_by_staff":"Todos pueden ver las etiquetas, pero solo el staff puede utilizarlas","visible_only_to_staff":"Solo el staff puede ver las etiquetas"},"topics":{"none":{"unread":"No tienes temas sin leer.","new":"No tienes temas nuevos.","read":"Todavía no has leído ningún tema.","posted":"Todavía no has publicado en ningún tema.","latest":"No hay temas recientes.","bookmarks":"No has guardado ningún tema en marcadores todavía.","top":"No hay temas destacados."},"bottom":{"latest":"No hay más temas recientes.","posted":"No hay más temas publicados.","read":"No hay más temas leídos.","new":"No hay más temas nuevos.","unread":"No hay más temas sin leer.","top":"No hay más temas destacados","bookmarks":"No hay más temas guardados en marcadores."}}},"invite":{"custom_message":"Dale a tu invitación un toque personal escribiendo un \u003ca href\u003emensaje personalizado\u003c/a\u003e.","custom_message_placeholder":"Ingresa tu mensaje personalizado","custom_message_template_forum":"¡Hey, deberías unirte a este foro!","custom_message_template_topic":"¡Hey, creemos que este tema te va a encantar!"},"forced_anonymous":"Debido a una carga extrema, esto se está mostrando temporalmente a todos como lo vería un usuario que no haya iniciado sesión.","safe_mode":{"enabled":"El modo seguro está activado, para salir del modo seguro cierra esta ventana del navegador"},"poll":{"voters":{"one":"votante","other":"votantes"},"total_votes":{"one":"voto total","other":"total de votos"},"average_rating":"Puntuación media: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Los votos son \u003cstrong\u003epúblicos\u003c/strong\u003e."},"results":{"groups":{"title":"Necesitas ser parte del grupo %{groups} para votar en esta encuesta."},"vote":{"title":"Los resultados se mostrarán cuando \u003cstrong\u003evotes\u003c/strong\u003e."},"closed":{"title":"Los resultados se mostrarán una vez que la encuesta esté \u003cstrong\u003ecerrada\u003c/strong\u003e."},"staff":{"title":"Los resultados solo se muestran a miembros del \u003cstrong\u003estaff\u003c/strong\u003e."}},"multiple":{"help":{"at_least_min_options":{"one":"Elige al menos \u003cstrong\u003e%{count}\u003c/strong\u003e opción","other":"Elige al menos \u003cstrong\u003e%{count}\u003c/strong\u003e opciones"},"up_to_max_options":{"one":"Elige \u003cstrong\u003e%{count}\u003c/strong\u003e opción","other":"Elige hasta \u003cstrong\u003e%{count}\u003c/strong\u003e opciones"},"x_options":{"one":"Elige \u003cstrong\u003e%{count}\u003c/strong\u003e opción","other":"Elige \u003cstrong\u003e%{count}\u003c/strong\u003e opciones"},"between_min_and_max_options":"Elige entre \u003cstrong\u003e%{min}\u003c/strong\u003e y \u003cstrong\u003e%{max}\u003c/strong\u003e opciones."}},"cast-votes":{"title":"Emite tus votos","label":"¡Vota ahora!"},"show-results":{"title":"Mostrar los resultados de la encuesta","label":"Mostrar resultados"},"hide-results":{"title":"Volver a tus votos","label":"Mostrar votos"},"group-results":{"title":"Agrupar votos por campo de usuario","label":"Mostrar desglose"},"ungroup-results":{"title":"Combinar todos los votos","label":"Ocultar desglose"},"export-results":{"title":"Exportar los resultados de la encuesta","label":"Exportar"},"open":{"title":"Abrir la encuesta","label":"Abrir","confirm":"¿Estás seguro de que quieres abrir esta encuesta?"},"close":{"title":"Cerrar la encuesta","label":"Cerrar","confirm":"¿Estás seguro de que quieres cerrar esta encuesta?"},"automatic_close":{"closes_in":"Cierra en \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Cerrado \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Lo sentimos, se produjo un error al cambiar el estado de esta encuesta.","error_while_casting_votes":"Lo sentimos, se produjo un error al emitir tus votos.","error_while_fetching_voters":"Lo sentimos, se produjo un error al mostrar los votantes.","error_while_exporting_results":"Lo sentimos, ha habido un error al exportar los resultados de la encuesta.","ui_builder":{"title":"Crear encuesta","insert":"Insertar encuesta","help":{"options_count":"Ingresa al menos 1 opción","invalid_values":"El valor mínimo debe ser menor que el valor máximo.","min_step_value":"El valor mínimo es 1"},"poll_type":{"label":"Tipo","regular":"Una opción","multiple":"Múltiples opciones","number":"Valoración numérica"},"poll_result":{"label":"Resultados","always":"Siempre visible","vote":"En votación","closed":"Cuando esté cerrada","staff":"Solo staff"},"poll_groups":{"label":"Grupos permitidos"},"poll_chart_type":{"label":"Tipo de gráfico"},"poll_config":{"max":"Máximo","min":"Mínimo","step":"Intervalo"},"poll_public":{"label":"Mostrar quién votó"},"poll_options":{"label":"Ingresa una opción de la encuesta por línea"},"automatic_close":{"label":"Cerrar encuesta automáticamente"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Inicia el tutorial de usuario nuevo para todos los usuarios nuevos","welcome_message":"Envía a todos los usuarios nuevos un mensaje de bienvenida junto a una guía de inicio rápido"}},"discourse_local_dates":{"relative_dates":{"today":"Hoy %{time}","tomorrow":"Mañana %{time}","yesterday":"Ayer %{time}","countdown":{"passed":"la fecha ha pasado"}},"title":"insertar fecha / hora","create":{"form":{"insert":"Insertar","advanced_mode":"Modo avanzado","simple_mode":"Modo simple","format_description":"Formato usado para mostrar la fecha al usuario. Use «\\T\\Z» para mostrar la zona horaria del usuario en palabras (Europa/París)","timezones_title":"Zonas horarias que se muestran","timezones_description":"Las zonas horarias se usarán para mostrar las fechas en vista previa y retrospectiva.","recurring_title":"Recurrencia","recurring_description":"Definir la recurrencia de un evento. También puedes editar manualmente la opción recurrente generada por el formulario y usar una de las siguientes claves: años, trimestre, meses, semanas, días, horas, minutos, segundos, milisegundos.","recurring_none":"Sin recurrencia","invalid_date":"Fecha inválida, asegúrate de que la fecha y hora sean correctas","date_title":"Fecha","time_title":"Hora","format_title":"Formato de fecha","timezone":"Zona horaria","until":"Hasta...","recurring":{"every_day":"Cada día","every_week":"Cada semana","every_two_weeks":"Cada dos semanas","every_month":"Cada mes","every_two_months":"Cada dos meses","every_three_months":"Cada tres meses","every_six_months":"Cada seis meses","every_year":"Cada año"}}}},"details":{"title":"Ocultar detalles"},"presence":{"replying":"respondiendo","editing":"editando","replying_to_topic":{"one":"respondiendo","other":"respondiendo"}},"voting":{"title":"Votación","reached_limit":"Se te acabaron los votos, ¡elimina un voto existente!","list_votes":"Lista de tus votos","votes_nav_help":"temas con más votos","voted":"Votaste sobre este tema","allow_topic_voting":"Permitir a los usuarios votar sobre temas en esta categoría","vote_title":"Votar","vote_title_plural":"Votos","voted_title":"Votado","voting_closed_title":"Cerrado","voting_limit":"Límite","votes_left":{"one":"Te queda {{count}} voto, ver \u003ca href='{{path}}'\u003etus votos\u003c/a\u003e.","other":"Te quedan {{count}} votos, mira \u003ca href='{{path}}'\u003etus votos\u003c/a\u003e."},"votes":{"one":"{{count}} voto","other":"{{count}} votos"},"anonymous_button":{"one":"Voto","other":"Votos"},"remove_vote":"Quitar voto"},"adplugin":{"advertisement_label":"PUBLICIDAD"},"docker":{"upgrade":"Tu instalación de Discourse está desactualizada.","perform_upgrade":"Haz clic aquí para actualizar."}}},"zh_CN":{},"en":{"js":{"local_time":"Local Time","discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'es';
I18n.pluralizationRules.es = MessageFormat.locale.es;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var monthsShortDot = 'ene._feb._mar._abr._may._jun._jul._ago._sep._oct._nov._dic.'.split('_'),
        monthsShort = 'ene_feb_mar_abr_may_jun_jul_ago_sep_oct_nov_dic'.split('_');

    var monthsParse = [/^ene/i, /^feb/i, /^mar/i, /^abr/i, /^may/i, /^jun/i, /^jul/i, /^ago/i, /^sep/i, /^oct/i, /^nov/i, /^dic/i];
    var monthsRegex = /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene\.?|feb\.?|mar\.?|abr\.?|may\.?|jun\.?|jul\.?|ago\.?|sep\.?|oct\.?|nov\.?|dic\.?)/i;

    var es = moment.defineLocale('es', {
        months : 'enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre'.split('_'),
        monthsShort : function (m, format) {
            if (!m) {
                return monthsShortDot;
            } else if (/-MMM-/.test(format)) {
                return monthsShort[m.month()];
            } else {
                return monthsShortDot[m.month()];
            }
        },
        monthsRegex : monthsRegex,
        monthsShortRegex : monthsRegex,
        monthsStrictRegex : /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
        monthsShortStrictRegex : /^(ene\.?|feb\.?|mar\.?|abr\.?|may\.?|jun\.?|jul\.?|ago\.?|sep\.?|oct\.?|nov\.?|dic\.?)/i,
        monthsParse : monthsParse,
        longMonthsParse : monthsParse,
        shortMonthsParse : monthsParse,
        weekdays : 'domingo_lunes_martes_miércoles_jueves_viernes_sábado'.split('_'),
        weekdaysShort : 'dom._lun._mar._mié._jue._vie._sáb.'.split('_'),
        weekdaysMin : 'do_lu_ma_mi_ju_vi_sá'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D [de] MMMM [de] YYYY',
            LLL : 'D [de] MMMM [de] YYYY H:mm',
            LLLL : 'dddd, D [de] MMMM [de] YYYY H:mm'
        },
        calendar : {
            sameDay : function () {
                return '[hoy a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            nextDay : function () {
                return '[mañana a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            nextWeek : function () {
                return 'dddd [a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            lastDay : function () {
                return '[ayer a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            lastWeek : function () {
                return '[el] dddd [pasado a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
            },
            sameElse : 'L'
        },
        relativeTime : {
            future : 'en %s',
            past : 'hace %s',
            s : 'unos segundos',
            ss : '%d segundos',
            m : 'un minuto',
            mm : '%d minutos',
            h : 'una hora',
            hh : '%d horas',
            d : 'un día',
            dd : '%d días',
            M : 'un mes',
            MM : '%d meses',
            y : 'un año',
            yy : '%d años'
        },
        dayOfMonthOrdinalParse : /\d{1,2}º/,
        ordinal : '%dº',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return es;

})));

// moment-timezone-localization for lang code: es

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abiyán","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Acra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Argel","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bisáu","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"El Cairo","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Yibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Duala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiún","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburgo","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Jartún","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadiscio","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Yamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nuakchot","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Uagadugú","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Portonovo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Santo Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Trípoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Túnez","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguila","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaína","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Río Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucumán","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahía","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahía de Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belén","id":"America/Belem"},{"value":"America/Belize","name":"Belice","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogotá","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancún","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayena","id":"America/Cayenne"},{"value":"America/Cayman","name":"Caimán","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiabá","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curazao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepé","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Gran Turca","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Granada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadalupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"La Habana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianápolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaica","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Ángeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceió","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaos","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinica","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlán","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Mérida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Ciudad de México","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelón","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"Nueva York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Dakota del Norte","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Dakota del Norte","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Dakota del Norte","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panamá","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Puerto Príncipe","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Puerto España","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Puerto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Río Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarém","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago de Chile","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"San Bartolomé","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"San Juan de Terranova","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"San Cristóbal","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Santa Lucía","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"St. Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"San Vicente","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tórtola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Adén","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Ammán","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anádyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktobe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Asjabad","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyrau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Baréin","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Bakú","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaúl","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beirut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bishkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunéi","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Calcuta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Chitá","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Choibalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damasco","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Daca","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubái","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dusambé","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebrón","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hong Kong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Yakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jerusalén","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamchatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandú","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Khandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnoyarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuwait","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadán","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makasar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Mascate","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicosia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pyongyang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Catar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kyzylorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Yangón (Rangún)","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ciudad Ho Chi Minh","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sajalín","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarcanda","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seúl","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Shanghái","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapur","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolimsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipéi","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taskent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tiflis","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teherán","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Timbu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulán Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Ürümqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientián","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Yakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Ekaterimburgo","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Ereván","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azores","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermudas","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Islas Canarias","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Cabo Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Islas Feroe","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reikiavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Georgia del Sur","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Santa Elena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaida","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sídney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"tiempo universal coordinado","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Ámsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astracán","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Atenas","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrado","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlín","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Bruselas","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bucarest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chisináu","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Copenhague","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"hora de verano de IrlandaDublín","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Isla de Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Estambul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrado","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kírov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisboa","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Liubliana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"hora de verano británicaLondres","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxemburgo","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Mónaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moscú","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"París","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praga","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Roma","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Sarátov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferópol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopie","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofía","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Estocolmo","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallin","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uliánovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Úzhgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"El Vaticano","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Viena","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilna","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgogrado","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varsovia","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporiyia","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zúrich","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Navidad","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comoras","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahé","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldivas","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauricio","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Reunión","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Isla de Pascua","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fiyi","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galápagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulú","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marquesas","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Numea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palaos","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipán","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahití","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
