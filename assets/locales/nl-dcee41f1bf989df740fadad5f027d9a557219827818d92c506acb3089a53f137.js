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
r += "Laten we <a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">de discussie starten!</a> Er ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "is <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> topic";
return r;
},
"other" : function(d){
var r = "";
r += "zijn <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " en ";
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
})() + "</strong> bericht";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> berichten";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Bezoekers hebben er meer nodig om te lezen en op te antwoorden – minstens ";
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
})() + "</strong> topic";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " en ";
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
})() + "</strong> bericht";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> berichten";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " wordt aanbevolen. Alleen stafleden kunnen dit bericht zien.";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "Laten we <a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">de discussie starten!</a> Er ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "is <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> topic";
return r;
},
"other" : function(d){
var r = "";
r += "zijn <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Bezoekers hebben er meer nodig om te lezen en op te antwoorden – minstens ";
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
})() + "</strong> topic";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " wordt aanbevolen. Alleen stafleden kunnen dit bericht zien.";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "Laten we <a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">de discussie starten!</a> Er ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "is <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> bericht";
return r;
},
"other" : function(d){
var r = "";
r += "zijn <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> berichten";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Bezoekers hebben er meer nodig om te lezen en op te antwoorden – minstens ";
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
})() + "</strong> bericht";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> berichten";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " wordt aanbevolen. Alleen stafleden kunnen dit bericht zien.";
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
})() + " fout/uur";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/uur";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> heeft de limiet voor de website-instelling van ";
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
})() + " fout/uur";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/uur";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " bereikt.";
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
})() + " fout/minuut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/minuut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> heeft de limiet voor de website-instelling van ";
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
})() + " fout/minuut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/minuut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " bereikt.";
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
})() + " fout/uur";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/uur";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> heeft de limiet voor de website-instelling van ";
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
})() + " fout/uur";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/uur";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " bereikt.";
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
})() + " fout/minuut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/minuut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> heeft de limiet voor de website-instelling van ";
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
})() + " fout/minuut";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " fouten/minuut";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " bereikt.";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "Er ";
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
r += "is <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 ongelezen</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "zijn <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " ongelezen</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
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
r += "/new'>1 nieuw</a> topic";
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "zijn ";
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
})() + " nieuwe</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " over, of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "blader door andere topics in ";
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
r += "U gaat ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> bericht";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> berichten";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " en ";
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
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " van deze gebruiker verwijderen, zijn/haar account verwijderen, nieuwe registraties vanaf het IP-adres <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> blokkeren en het e-mailadres <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> op een permanente blokkeerlijst zetten. Weet u zeker dat deze gebruiker een spammer is?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Dit topic heeft ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 antwoord";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " antwoorden";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "met een hoge verhouding likes per bericht";
return r;
},
"med" : function(d){
var r = "";
r += "met een erg hoge verhouding likes per bericht";
return r;
},
"high" : function(d){
var r = "";
r += "met een zeer hoge verhouding likes per bericht";
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
r += "U gaat ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 bericht";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " berichten";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " en ";
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
r += (pf_0[ MessageFormat.locale["nl"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " verwijderen. Weet u het zeker?";
return r;
}};
MessageFormat.locale.nl = function ( n ) {
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

I18n.translations = {"nl":{"js":{"number":{"format":{"separator":",","delimiter":"."},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year":"D MMM, HH:mm","long_no_year_no_time":"D MMM","full_no_year_no_time":"D MMMM","long_with_year":"D MMM YYYY HH:mm","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"D MMMM YYYY","long_date_with_year":"D MMM 'YY HH:mm","long_date_without_year":"D MMM HH:mm","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eHH:mm","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eHH:mm","wrap_ago":"%{date} geleden","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}u","other":"%{count}u"},"x_days":{"one":"%{count}d","other":"%{count}d"},"x_months":{"one":"%{count}mnd","other":"%{count}mnd"},"about_x_years":{"one":"%{count}j","other":"%{count}j"},"over_x_years":{"one":"\u003e %{count}j","other":"\u003e %{count}j"},"almost_x_years":{"one":"%{count}j","other":"%{count}j"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} min","other":"%{count} min"},"x_hours":{"one":"%{count} uur","other":"%{count} uur"},"x_days":{"one":"%{count} dag","other":"%{count} dagen"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} min geleden","other":"%{count} min geleden"},"x_hours":{"one":"%{count} uur geleden","other":"%{count} uur geleden"},"x_days":{"one":"%{count} dag geleden","other":"%{count} dagen geleden"},"x_months":{"one":"%{count} maand geleden","other":"%{count} maanden geleden"},"x_years":{"one":"%{count} jaar geleden","other":"%{count} jaar geleden"}},"later":{"x_days":{"one":"%{count} dag later","other":"%{count} dagen later"},"x_months":{"one":"%{count} maand later","other":"%{count} maanden later"},"x_years":{"one":"%{count} jaar later","other":"%{count} jaar later"}},"previous_month":"Vorige maand","next_month":"Volgende maand","placeholder":"datum"},"share":{"topic_html":"Topic: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"bericht #%{postNumber}","close":"sluiten","twitter":"Deze koppeling delen op Twitter","facebook":"Deze koppeling delen op Facebook","email":"Deze koppeling delen in een e-mailbericht"},"action_codes":{"public_topic":"heeft dit topic openbaar gemaakt op %{when}","private_topic":"heeft dit topic een privébericht gemaakt op %{when}","split_topic":"heeft dit topic gesplitst op %{when}","invited_user":"heeft %{who} uitgenodigd op %{when}","invited_group":"heeft %{who} uitgenodigd op %{when}","user_left":"%{who} heeft zichzelf uit dit bericht verwijderd op %{when}","removed_user":"heeft %{who} verwijderd op %{when}","removed_group":"heeft %{who} verwijderd op %{when}","autobumped":"automatisch gebumpt op %{when}","autoclosed":{"enabled":"gesloten op %{when}","disabled":"geopend op %{when}"},"closed":{"enabled":"gesloten op %{when}","disabled":"geopend op %{when}"},"archived":{"enabled":"gearchiveerd op %{when}","disabled":"gedearchiveerd op %{when}"},"pinned":{"enabled":"vastgemaakt op %{when}","disabled":"losgemaakt op %{when}"},"pinned_globally":{"enabled":"globaal vastgemaakt op %{when}","disabled":"losgemaakt op %{when}"},"visible":{"enabled":"zichtbaar gemaakt op %{when}","disabled":"onzichtbaar gemaakt op %{when}"},"banner":{"enabled":"heeft deze banner gemaakt op %{when}. De banner verschijnt bovenaan elke pagina, totdat de gebruiker deze verbergt.","disabled":"heeft deze banner verwijderd op %{when}. De banner zal niet meer bovenaan elke pagina verschijnen."},"forwarded":"heeft de bovenstaande e-mail doorgestuurd"},"topic_admin_menu":"topicacties","wizard_required":"Welkom bij uw nieuwe Discourse! Laten we beginnen met \u003ca href='%{url}' data-auto-route='true'\u003ede configuratiewizard\u003c/a\u003e ✨","emails_are_disabled":"Alle uitgaande e-mail is uitgeschakeld door een beheerder. Er wordt geen enkele e-mailmelding verstuurd.","bootstrap_mode_enabled":"Om het opzetten van uw nieuwe website makkelijker te maken, bevindt u zich in bootstrapmodus. Aan alle nieuwe gebruikers wordt vertrouwensniveau 1 toegekend, en dagelijkse e-mailsamenvattingen zijn voor hen ingeschakeld. Dit wordt automatisch uitgeschakeld zodra %{min_users} gebruikers lid zijn geworden.","bootstrap_mode_disabled":"De bootstrapmodus wordt binnen 24 uur uitgeschakeld.","themes":{"default_description":"Standaard","broken_theme_alert":"Uw website werkt mogelijk niet, omdat het thema / onderdeel %{theme} fouten bevat. Schakel het uit via %{path}."},"s3":{"regions":{"ap_northeast_1":"Azië Pacifisch (Tokio)","ap_northeast_2":"Azië Pacifisch (Seoel)","ap_south_1":"Azië Pacifisch (Bombay)","ap_southeast_1":"Azië Pacifisch (Singapore)","ap_southeast_2":"Azië Pacifisch (Sydney)","ca_central_1":"Canada (Centraal)","cn_north_1":"China (Peking)","cn_northwest_1":"China (Ningxia)","eu_central_1":"EU (Frankfurt)","eu_north_1":"EU (Stockholm)","eu_west_1":"EU (Ierland)","eu_west_2":"EU (Londen)","eu_west_3":"EU (Parijs)","sa_east_1":"Zuid-Amerika (São Paulo)","us_east_1":"VS Oost (N. Virginia)","us_east_2":"VS Oost (Ohio)","us_gov_east_1":"AWS GovCloud (VS Oost)","us_gov_west_1":"AWS GovCloud (VS West)","us_west_1":"VS West (N. Californië)","us_west_2":"VS West (Oregon)"}},"edit":"de titel en categorie van dit topic bewerken","expand":"Uitvouwen","not_implemented":"Deze functie is helaas nog niet beschikbaar, sorry!","no_value":"Nee","yes_value":"Ja","submit":"Versturen","generic_error":"Sorry, er is iets fout gegaan.","generic_error_with_reason":"Er is iets fout gegaan: %{error}","go_ahead":"Ga uw gang","sign_up":"Registreren","log_in":"Aanmelden","age":"Leeftijd","joined":"Lid sinds","admin_title":"Beheer","show_more":"meer tonen","show_help":"opties","links":"Koppelingen","links_lowercase":{"one":"koppeling","other":"koppelingen"},"faq":"FAQ","guidelines":"Richtlijnen","privacy_policy":"Privacybeleid","privacy":"Privacy","tos":"Algemene Voorwaarden","rules":"Regels","conduct":"Gedragscode","mobile_view":"Mobiele weergave","desktop_view":"Desktopweergave","you":"U","or":"of","now":"zojuist","read_more":"meer info","more":"Meer","less":"Minder","never":"nooit","every_30_minutes":"elke 30 minuten","every_hour":"elk uur","daily":"dagelijks","weekly":"wekelijks","every_month":"elke maand","every_six_months":"elke zes maanden","max_of_count":"maximaal {{count}}","alternation":"of","character_count":{"one":"{{count}} teken","other":"{{count}} tekens"},"related_messages":{"title":"Gerelateerde berichten","see_all":"\u003ca href=\"%{path}\"\u003eAlle berichten\u003c/a\u003e van @%{username}bekijken..."},"suggested_topics":{"title":"Aanbevolen topics","pm_title":"Voorgestelde berichten"},"about":{"simple_title":"Over","title":"Over %{title}","stats":"Websitestatistieken","our_admins":"Onze beheerders","our_moderators":"Onze moderators","moderators":"Moderators","stat":{"all_time":"Sinds het begin","last_7_days":"Laatste 7","last_30_days":"Laatste 30"},"like_count":"Likes","topic_count":"Topics","post_count":"Berichten","user_count":"Gebruikers","active_user_count":"Actieve gebruikers","contact":"Contact","contact_info":"Neem in het geval van een kritieke kwestie of dringende vraagstukken in verband met deze website contact met ons op via %{contact_info}."},"bookmarked":{"title":"Bladwijzer maken","clear_bookmarks":"Bladwijzers wissen","help":{"bookmark":"Klik om een bladwijzer voor het eerste bericht van dit topic te maken","unbookmark":"Klik om alle bladwijzers in dit topic te verwijderen","unbookmark_with_reminder":"Klik om alle bladwijzers en herinneringen in dit topic te verwijderen. U hebt voor dit topic een herinnering ingesteld voor %{reminder_at}."}},"bookmarks":{"created":"u hebt een bladwijzer voor dit bericht gemaakt","not_bookmarked":"bladwijzer voor dit bericht maken","created_with_reminder":"u hebt een bladwijzer voor dit bericht gemaakt met een herinnering voor %{date}","created_with_at_desktop_reminder":"u hebt een bladwijzer voor dit bericht gemaakt en wordt de volgende keer dat u uw computer gebruikt herinnerd","remove":"Bladwijzer verwijderen","delete":"Bladwijzer verwijderen","confirm_delete":"Weet u zeker dat u deze bladwijzer wilt verwijderen? De herinnering wordt ook verwijderd.","confirm_clear":"Weet u zeker dat u alle bladwijzers van dit topic wilt verwijderen?","save":"Opslaan","no_timezone":"U hebt nog geen tijdzone ingesteld. Hierdoor kunt u geen herinneringen instellen. Stel er een in \u003ca href=\"%{basePath}/my/preferences/profile\"\u003ein uw profiel\u003c/a\u003e.","invalid_custom_datetime":"De datum en tijd die u hebt opgegeven is ongeldig, probeer het opnieuw.","list_permission_denied":"U hebt geen toestemming om de bladwijzers van deze gebruiker te bekijken.","reminders":{"at_desktop":"De volgende keer vanaf mijn computer","later_today":"Later vandaag","next_business_day":"Volgende werkdag","tomorrow":"Morgen","next_week":"Volgende week","later_this_week":"Later deze week","start_of_next_business_week":"Volgende maandag","next_month":"Volgende maand","custom":"Aangepaste datum en tijd","last_custom":"Afgelopen","none":"Geen herinnering nodig","today_with_time":"vandaag om %{time}","tomorrow_with_time":"morgen om %{time}","at_time":"op %{date_time}","existing_reminder":"U hebt een herinnering voor deze bladwijzer ingesteld die wordt verzonden"}},"drafts":{"resume":"Hervatten","remove":"Verwijderen","new_topic":"Nieuw-topicconcept","new_private_message":"Nieuw-privéberichtconcept","topic_reply":"Conceptantwoord","abandon":{"confirm":"U hebt al een ander concept geopend in dit topic. Weet u zeker dat u het wilt afbreken?","yes_value":"Ja, afbreken","no_value":"Nee, behouden"}},"topic_count_latest":{"one":"{{count}} nieuw of bijgewerkt topic bekijken","other":"{{count}} nieuwe of bijgewerkte topics bekijken"},"topic_count_unread":{"one":"{{count}} ongelezen topic bekijken","other":"{{count}} ongelezen topics bekijken"},"topic_count_new":{"one":"{{count}} nieuw topic bekijken","other":"{{count}} nieuwe topics bekijken"},"preview":"voorbeeld","cancel":"annuleren","save":"Wijzigingen opslaan","saving":"Opslaan...","saved":"Opgeslagen!","upload":"Uploaden","uploading":"Uploaden...","uploading_filename":"Uploaden: {{filename}}...","clipboard":"klembord","uploaded":"Geüpload!","pasting":"Plakken...","enable":"Inschakelen","disable":"Uitschakelen","continue":"Doorgaan","undo":"Ongedaan maken","revert":"Terugzetten","failed":"Mislukt","switch_to_anon":"Anonieme modus starten","switch_from_anon":"Anonieme modus verlaten","banner":{"close":"Deze banner verbergen","edit":"Deze banner bewerken \u003e\u003e"},"pwa":{"install_banner":"Wilt u \u003ca href\u003e%{title} op dit apparaat installeren?\u003c/a\u003e"},"choose_topic":{"none_found":"Geen topics gevonden.","title":{"search":"Zoeken naar een topic","placeholder":"typ hier de titel, URL of ID van het topic"}},"choose_message":{"none_found":"Geen berichten gevonden.","title":{"search":"Zoeken naar een bericht","placeholder":"typ hier de titel, URL of ID van het bericht"}},"review":{"order_by":"Sorteren op","in_reply_to":"in reactie op","explain":{"why":"leg uit waarom dit item in de wachtrij is beland","title":"Beoordeelbare scores","formula":"Formule","subtotal":"Subtotaal","total":"Totaal","min_score_visibility":"Minimale score voor zichtbaarheid","score_to_hide":"Score voor verbergen van bericht","take_action_bonus":{"name":"heeft actie ondernomen","title":"Wanneer een staflid kiest voor het ondernemen van actie, wordt een bonus aan de markering gegeven."},"user_accuracy_bonus":{"name":"gebruikersnauwkeurigheid","title":"Gebruikers waarvan markeringen in het verleden zijn geaccordeerd ontvangen een bonus."},"trust_level_bonus":{"name":"vertrouwensniveau","title":"Beoordeelbare items die door gebruikers met een hoger vertrouwensniveau zijn gemaakt hebben een hogere score."},"type_bonus":{"name":"type bonus","title":"Aan bepaalde beoordeelbare typen kan door stafleden een bonus worden toegekend om ze hogere prioriteit te geven."}},"claim_help":{"optional":"U kunt dit item opeisen om te voorkomen dat anderen het beoordelen.","required":"U moet items opeisen voordat u ze kunt beoordelen.","claimed_by_you":"U hebt dit item opgeëist en kunt het beoordelen.","claimed_by_other":"Dit item kan alleen worden beoordeeld door \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"dit topic opeisen"},"unclaim":{"help":"deze claim verwijderen"},"awaiting_approval":"Wacht op goedkeuring","delete":"Verwijderen","settings":{"saved":"Opgeslagen","save_changes":"Wijzigingen opslaan","title":"Instellingen","priorities":{"title":"Beoordeelbare prioriteiten"}},"moderation_history":"Moderatiegeschiedenis","view_all":"Alle bekijken","grouped_by_topic":"Gegroepeerd op topic","none":"Er zijn geen items om te beoordelen.","view_pending":"wachtende bekijken","topic_has_pending":{"one":"Dit topic heeft \u003cb\u003e%{count}\u003c/b\u003e bericht dat op goedkeuring wacht","other":"Dit topic heeft \u003cb\u003e{{count}}\u003c/b\u003e berichten die op goedkeuring wachten"},"title":"Beoordelen","topic":"Topic:","filtered_topic":"U hebt op beoordeelbare inhoud in één topic gefilterd.","filtered_user":"Gebruiker","show_all_topics":"alle topics tonen","deleted_post":"(bericht verwijderd)","deleted_user":"(gebruiker verwijderd)","user":{"bio":"Biografie","website":"Website","username":"Gebruikersnaam","email":"E-mailadres","name":"Naam","fields":"Velden"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} totale markering)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} totale markeringen)"},"agreed":{"one":"{{count}}% akkoord","other":"{{count}}% akkoord"},"disagreed":{"one":"{{count}}% niet akkoord","other":"{{count}}% niet akkoord"},"ignored":{"one":"{{count}}% genegeerd","other":"{{count}}% genegeerd"}},"topics":{"topic":"Topic","reviewable_count":"Aantal","reported_by":"Gemeld door","deleted":"[Topic verwijderd]","original":"(oorspronkelijk topic)","details":"details","unique_users":{"one":"%{count} gebruiker","other":"{{count}} gebruikers"}},"replies":{"one":"%{count} antwoord","other":"{{count}} antwoorden"},"edit":"Bewerken","save":"Opslaan","cancel":"Annuleren","new_topic":"Goedkeuren van dit item maakt een nieuw topic","filters":{"all_categories":"(alle categorieën)","type":{"title":"Type","all":"(alle typen)"},"minimum_score":"Minimale score:","refresh":"Vernieuwen","status":"Status","category":"Categorie","orders":{"priority":"Prioriteit","priority_asc":"Prioriteit (omgekeerd)","created_at":"Lid sinds","created_at_asc":"Gemaakt op (omgekeerd)"},"priority":{"title":"Minimale prioriteit","low":"(alle)","medium":"Gemiddeld","high":"Hoog"}},"conversation":{"view_full":"volledige conversatie bekijken"},"scores":{"about":"Deze score wordt berekend op basis van het vertrouwen van de melder, de nauwkeurigheid van zijn of haar eerdere markeringen, en de prioriteit van het item dat wordt gemeld.","score":"Score","date":"Datum","type":"Type","status":"Status","submitted_by":"Ingediend door","reviewed_by":"Beoordeeld door"},"statuses":{"pending":{"title":"In wachtrij"},"approved":{"title":"Goedgekeurd"},"rejected":{"title":"Geweigerd"},"ignored":{"title":"Genegeerd"},"deleted":{"title":"Verwijderd"},"reviewed":{"title":"(alle beoordeelde)"},"all":{"title":"(alles)"}},"types":{"reviewable_flagged_post":{"title":"Gemarkeerd bericht","flagged_by":"Gemarkeerd door"},"reviewable_queued_topic":{"title":"Topic in wachtrij"},"reviewable_queued_post":{"title":"Bericht in wachtrij"},"reviewable_user":{"title":"Gebruiker"}},"approval":{"title":"Bericht heeft goedkeuring nodig","description":"We hebben uw nieuwe bericht ontvangen, maar dit moet eerst door een moderator worden goedgekeurd voordat het zichtbaar wordt. Heb geduld.","pending_posts":{"one":"U hebt \u003cstrong\u003e%{count}\u003c/strong\u003e wachtend bericht.","other":"U hebt \u003cstrong\u003e{{count}}\u003c/strong\u003e wachtende berichten."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e heeft \u003ca href='{{topicUrl}}'\u003ehet topic\u003c/a\u003e geplaatst","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eU\u003c/a\u003e hebt \u003ca href='{{topicUrl}}'\u003ehet topic\u003c/a\u003e geplaatst","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e heeft op \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e geantwoord","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eU\u003c/a\u003e hebt op \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e geantwoord","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e heeft op \u003ca href='{{topicUrl}}'\u003ehet topic\u003c/a\u003e geantwoord","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eU\u003c/a\u003e hebt op \u003ca href='{{topicUrl}}'\u003ehet topic\u003c/a\u003e geantwoord","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e heeft \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e genoemd","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e heeft \u003ca href='{{user2Url}}'\u003eu\u003c/a\u003e genoemd","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eU\u003c/a\u003e hebt \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e genoemd","posted_by_user":"Geplaatst door \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Geplaatst door \u003ca href='{{userUrl}}'\u003eu\u003c/a\u003e","sent_by_user":"Verzonden door \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Verzonden door \u003ca href='{{userUrl}}'\u003eu\u003c/a\u003e"},"directory":{"filter_name":"filteren op gebruikersnaam","title":"Gebruikers","likes_given":"Gegeven","likes_received":"Ontvangen","topics_entered":"Bekeken","topics_entered_long":"Topics bekeken","time_read":"Tijd gelezen","topic_count":"Topics","topic_count_long":"Topics gemaakt","post_count":"Antwoorden","post_count_long":"Antwoorden geplaatst","no_results":"Geen resultaten gevonden.","days_visited":"Bezoeken","days_visited_long":"Dagen bezocht","posts_read":"Gelezen","posts_read_long":"Berichten gelezen","last_updated":"Laatst bijgewerkt:","total_rows":{"one":"%{count} gebruiker","other":"%{count} gebruikers"}},"group_histories":{"actions":{"change_group_setting":"Groepsinstelling wijzigen","add_user_to_group":"Gebruiker toevoegen","remove_user_from_group":"Gebruiker verwijderen","make_user_group_owner":"Eigenaar maken","remove_user_as_group_owner":"Eigenaar intrekken"}},"groups":{"member_added":"Toegevoegd","member_requested":"Aangevraagd:","add_members":{"title":"Leden toevoegen","description":"Het lidmaatschap van deze groep beheren","usernames":"Gebruikersnamen"},"requests":{"title":"Aanvragen","reason":"Reden","accept":"Accepteren","accepted":"geaccepteerd","deny":"Weigeren","denied":"geweigerd","undone":"aanvraag ongedaan gemaakt","handle":"lidmaatschapsaanvraag behandelen"},"manage":{"title":"Beheren","name":"Naam","full_name":"Volledige naam","add_members":"Leden toevoegen","delete_member_confirm":"'%{username}' uit de groep '%{group}' verwijderen?","profile":{"title":"Profiel"},"interaction":{"title":"Interactie","posting":"Plaatsen","notification":"Melding"},"membership":{"title":"Lidmaatschap","access":"Toegang"},"logs":{"title":"Logboeken","when":"Wanneer","action":"Actie","acting_user":"Uitvoerende gebruiker","target_user":"Doelgebruiker","subject":"Onderwerp","details":"Details","from":"Van","to":"Naar"}},"public_admission":"Gebruikers mogen vrij aan de groep deelnemen (Vereist openbaar zichtbare groep)","public_exit":"Gebruikers mogen vrij de groep verlaten","empty":{"posts":"Er zijn geen berichten van leden van deze groep.","members":"Er zijn geen leden in deze groep.","requests":"Er zijn geen lidmaatschapsaanvragen voor deze groep.","mentions":"Er zijn geen vermeldingen van deze groep.","messages":"Er zijn geen berichten voor deze groep.","topics":"Er zijn geen topics van leden van deze groep.","logs":"Er zijn geen logs voor deze groep."},"add":"Toevoegen","join":"Toetreden","leave":"Verlaten","request":"Aanvraag","message":"Bericht","confirm_leave":"Weet u zeker dat u deze groep wilt verlaten?","allow_membership_requests":"Gebruikers mogen lidmaatschapsaanvragen naar groepseigenaren sturen (Vereist openbaar zichtbare groep)","membership_request_template":"Aangepaste sjabloon om weer te geven voor gebruikers bij het sturen van een lidmaatschapsaanvraag","membership_request":{"submit":"Aanvraag versturen","title":"Verzoek voor deelname aan @%{group_name}","reason":"Laat de groepseigenaren weten waarom u in deze groep hoort"},"membership":"Lidmaatschap","name":"Naam","group_name":"Groepsnaam","user_count":"Gebruikers","bio":"Over groep","selector_placeholder":"voer gebruikersnaam in","owner":"eigenaar","index":{"title":"Groepen","all":"Alle groepen","empty":"Er zijn geen zichtbare groepen.","filter":"Filteren op groepstype","owner_groups":"Mijn groepen","close_groups":"Besloten groepen","automatic_groups":"Automatische groepen","automatic":"Automatisch","closed":"Gesloten","public":"Openbaar","private":"Privé","public_groups":"Openbare groepen","automatic_group":"Automatische groep","close_group":"Besloten groep","my_groups":"Mijn groepen","group_type":"Groepstype","is_group_user":"Lid","is_group_owner":"Eigenaar"},"title":{"one":"Groep","other":"Groepen"},"activity":"Activiteit","members":{"title":"Leden","filter_placeholder_admin":"gebruikersnaam of e-mailadres","filter_placeholder":"gebruikersnaam","remove_member":"Lid verwijderen","remove_member_description":"\u003cb\u003e%{username}\u003c/b\u003e uit deze groep verwijderen","make_owner":"Eigenaar maken","make_owner_description":"\u003cb\u003e%{username}\u003c/b\u003e een eigenaar van deze groep maken","remove_owner":"Verwijderen als eigenaar","remove_owner_description":"\u003cb\u003e%{username}\u003c/b\u003e als een eigenaar van deze groep verwijderen","owner":"Eigenaar","forbidden":"U mag de leden niet bekijken."},"topics":"Topics","posts":"Berichten","mentions":"Vermeldingen","messages":"Berichten","notification_level":"Standaard meldingsniveau voor groepsberichten","alias_levels":{"mentionable":"Wie kan deze groep taggen?","messageable":"Wie kan deze groep een bericht sturen?","nobody":"Niemand","only_admins":"Alleen beheerders","mods_and_admins":"Alleen moderators en beheerders","members_mods_and_admins":"Alleen groepsleden, moderators en beheerders","owners_mods_and_admins":"Alleen groepseigenaren, moderators en beheerders","everyone":"Iedereen"},"notifications":{"watching":{"title":"In de gaten houden","description":"U ontvangt een melding bij elk nieuw bericht, en het aantal nieuwe antwoorden wordt weergeven."},"watching_first_post":{"title":"Eerste bericht in de gaten houden","description":"U ontvangt meldingen van nieuwe berichten in deze groep, maar niet van antwoorden op de berichten."},"tracking":{"title":"Volgen","description":"U ontvangt een melding wanneer iemand uw @naam noemt of een bericht van u beantwoordt, en het aantal nieuwe antwoorden wordt weergeven."},"regular":{"title":"Normaal","description":"U ontvangt een melding wanneer iemand uw @naam noemt of een bericht van uw beantwoordt."},"muted":{"title":"Genegeerd","description":"U ontvangt geen enkele melding over berichten in deze groep."}},"flair_url":"Afbeelding voor avatar-flair","flair_url_placeholder":"(Optioneel) Afbeeldings-URL of Font Awesome-klasse","flair_url_description":"Gebruik vierkante afbeeldingen die niet kleiner zijn dan 20 bij 20 pixels of FontAwesome-pictogrammen (geaccepteerde formaten: 'fa-icon', 'far fa-icon' of 'fab fa-icon').","flair_bg_color":"Achtergrondkleur van avatar-flair","flair_bg_color_placeholder":"(Optioneel) Hex-kleurwaarde","flair_color":"Kleur van avatar-flair","flair_color_placeholder":"(Optioneel) Hex-kleurwaarde","flair_preview_icon":"Pictogramvoorbeeld","flair_preview_image":"Afbeeldingsvoorbeeld"},"user_action_groups":{"1":"Gegeven likes","2":"Ontvangen likes","3":"Favorieten","4":"Topics","5":"Antwoorden","6":"Reacties","7":"Vermeldingen","9":"Citaten","11":"Bewerkingen","12":"Verzonden items","13":"Inbox","14":"In wachtrij","15":"Concepten"},"categories":{"all":"Alle categorieën","all_subcategories":"alles","no_subcategory":"geen","category":"Categorie","category_list":"Categorielijst weergeven","reorder":{"title":"Categorieën herschikken ","title_long":"De categorielijst opnieuw ordenen","save":"Volgorde opslaan","apply_all":"Toepassen","position":"Positie"},"posts":"Berichten","topics":"Topics","latest":"Nieuwste","latest_by":"nieuwste door","toggle_ordering":"sorteermethode omschakelen","subcategories":"Subcategorieën","topic_sentence":{"one":"%{count} topic","other":"%{count} topics"},"topic_stat_sentence_week":{"one":"%{count} nieuw topic in de afgelopen week.","other":"%{count} nieuwe topics in de afgelopen week."},"topic_stat_sentence_month":{"one":"%{count} nieuw topic in de afgelopen maand.","other":"%{count} nieuwe topics in de afgelopen maand."},"n_more":"Categorieën (nog %{count}) ..."},"ip_lookup":{"title":"IP-adres zoeken","hostname":"Hostnaam","location":"Locatie","location_not_found":"(onbekend)","organisation":"Organisatie","phone":"Telefoon","other_accounts":"Andere accounts met dit IP-adres:","delete_other_accounts":"%{count} verwijderen","username":"gebruikersnaam","trust_level":"TL","read_time":"leestijd","topics_entered":"topics ingevoerd","post_count":"# berichten","confirm_delete_other_accounts":"Weet u zeker dat u deze accounts wilt verwijderen?","powered_by":"gebruikt \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"gekopieerd"},"user_fields":{"none":"(selecteer een optie)"},"user":{"said":"{{username}}:","profile":"Profiel","mute":"Negeren","edit":"Voorkeuren bewerken","download_archive":{"button_text":"Alles downloaden","confirm":"Weet u zeker dat u uw berichten wilt downloaden?","success":"Downloaden is gestart; u ontvangt een melding zodra het proces is voltooid.","rate_limit_error":"Berichten kunnen maar één keer per dag worden gedownload; probeer het morgen opnieuw."},"new_private_message":"Nieuw bericht","private_message":"Bericht","private_messages":"Berichten","user_notifications":{"ignore_duration_title":"Negeertimer","ignore_duration_username":"Gebruikersnaam","ignore_duration_when":"Tijdsduur:","ignore_duration_save":"Negeren","ignore_duration_note":"Houd er rekening mee dat alle negeeracties na het verlopen van de tijdsduur automatisch worden verwijderd.","ignore_duration_time_frame_required":"Selecteer een tijdsbestek","ignore_no_users":"U hebt geen genegeerde gebruikers.","ignore_option":"Genegeerd","ignore_option_title":"U ontvangt geen meldingen met betrekking tot deze gebruiker, en alle topics en antwoorden ervan worden verborgen.","add_ignored_user":"Toevoegen...","mute_option":"Gedempt","mute_option_title":"U ontvangt geen meldingen met betrekking tot deze gebruiker.","normal_option":"Normaal","normal_option_title":"U ontvangt een melding als deze gebruiker een bericht van u beantwoordt, u citeert, of uw naam noemt."},"activity_stream":"Activiteit","preferences":"Voorkeuren","feature_topic_on_profile":{"open_search":"Selecteer een nieuw topic","title":"Een topic selecteren","search_label":"Zoeken naar topic op titel","save":"Opslaan","clear":{"title":"Wissen","warning":"Weet u zeker dat u uw aanbevolen topic wilt wissen?"}},"use_current_timezone":"Huidige tijdzone gebruiken","profile_hidden":"Het openbare profiel van deze gebruiker is verborgen.","expand_profile":"Uitvouwen","collapse_profile":"Samenvouwen","bookmarks":"Favorieten","bio":"Over mij","timezone":"Tijdzone","invited_by":"Uitgenodigd door","trust_level":"Vertrouwensniveau","notifications":"Meldingen","statistics":"Statistieken ","desktop_notifications":{"label":"Livemeldingen","not_supported":"Meldingen worden in deze browser niet ondersteund. Sorry.","perm_default":"Meldingen inschakelen","perm_denied_btn":"Toestemming geweigerd","perm_denied_expl":"U hebt toestemming voor meldingen geweigerd. Sta meldingen toe via uw browserinstellingen.","disable":"Meldingen uitschakelen","enable":"Meldingen inschakelen","each_browser_note":"Opmerking: u moet deze instelling in elke browser die u gebruikt wijzigen.","consent_prompt":"Wilt u livemeldingen ontvangen als mensen op uw berichten antwoorden?"},"dismiss":"Negeren","dismiss_notifications":"Alle verwijderen","dismiss_notifications_tooltip":"Alle ongelezen meldingen markeren als gelezen","first_notification":"Uw eerste melding! Selecteer deze om te beginnen.","dynamic_favicon":"Aantal op browserpictogram tonen","theme_default_on_all_devices":"Dit het standaardthema maken op al mijn apparaten","text_size_default_on_all_devices":"Dit de standaard tekstgrootte maken op al mijn apparaten","allow_private_messages":"Andere gebruikers mogen mij persoonlijke berichten sturen","external_links_in_new_tab":"Alle externe koppelingen openen in een nieuw tabblad","enable_quoting":"Antwoord-met-citaat voor gemarkeerde tekst inschakelen","enable_defer":"Negeren voor markeren van topics als ongelezen inschakelen","change":"wijzigen","featured_topic":"Aanbevolen topic","moderator":"{{user}} is een moderator","admin":"{{user}} is een beheerder","moderator_tooltip":"Deze gebruiker is een moderator","admin_tooltip":"Deze gebruiker is een beheerder","silenced_tooltip":"Deze gebruiker is gedempt","suspended_notice":"Deze gebruiker is geschorst tot {{date}}.","suspended_permanently":"Deze gebruiker is geschorst.","suspended_reason":"Reden: ","github_profile":"Github","email_activity_summary":"Activiteitsamenvatting","mailing_list_mode":{"label":"Mailinglijstmodus","enabled":"Mailinglijstmodus inschakelen","instructions":"Deze instelling overschrijft de activiteitsamenvatting.\u003cbr /\u003e\nGenegeerde topics en categorieën zijn niet in deze e-mails inbegrepen.\n","individual":"Een e-mail voor elk nieuw bericht verzenden","individual_no_echo":"Een e-mail voor elk nieuw bericht verzenden, behalve die van mezelf","many_per_day":"Mij een e-mail voor elk nieuw bericht sturen (ongeveer {{dailyEmailEstimate}} per dag)","few_per_day":"Mij een e-mail voor elk nieuw bericht sturen (ongeveer 2 per dag)","warning":"Mailinglijstmodus ingeschakeld. E-mailmeldingsinstellingen worden genegeerd."},"tag_settings":"Tags","watched_tags":"In de gaten gehouden","watched_tags_instructions":"U houdt automatisch alle nieuwe topics met deze tags in de gaten. U ontvangt meldingen bij alle nieuwe berichten en topics, en het aantal nieuwe berichten verschijnt ook naast het topic.","tracked_tags":"Gevolgd","tracked_tags_instructions":"U volgt automatisch alle topics met deze tags. Het aantal nieuwe berichten verschijnt naast het topic.","muted_tags":"Genegeerd","muted_tags_instructions":"U ontvangt geen enkele melding over nieuwe topics met deze tags, en ze verschijnen niet in Nieuwste.","watched_categories":"In de gaten gehouden","watched_categories_instructions":"U houdt automatisch alle nieuwe topics in deze categorieën in de gaten. U ontvangt meldingen bij alle nieuwe berichten en topics, en het aantal nieuwe berichten verschijnt ook naast het topic.","tracked_categories":"Gevolgd","tracked_categories_instructions":"U volgt automatisch alle topics in deze categorieën. Het aantal nieuwe berichten verschijnt naast het topic.","watched_first_post_categories":"Eerste bericht in de gaten houden.","watched_first_post_categories_instructions":"U ontvangt een melding bij het eerste bericht in elk nieuw topic in deze categorieën.","watched_first_post_tags":"Eerste bericht in de gaten houden","watched_first_post_tags_instructions":"U ontvangt een melding bij het eerste bericht in elk nieuw topic met deze tags.","muted_categories":"Genegeerd","muted_categories_instructions":"U ontvangt geen enkele melding over nieuwe topics en berichten in deze categorieën, en ze verschijnen niet op de pagina's Categorieën of Nieuwste.","muted_categories_instructions_dont_hide":"U ontvangt geen enkele melding over nieuwe topics in deze categorieën.","no_category_access":"Als moderator hebt u beperkte toegang tot categorieën, opslaan is uitgeschakeld.","delete_account":"Mijn account verwijderen","delete_account_confirm":"Weet u zeker dat u uw account definitief wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt!","deleted_yourself":"Uw account is verwijderd.","delete_yourself_not_allowed":"Neem contact op met een staflid als u wilt dat uw account wordt verwijderd.","unread_message_count":"Berichten","admin_delete":"Verwijderen","users":"Gebruikers","muted_users":"Genegeerd","muted_users_instructions":"Alle meldingen van deze gebruikers onderdrukken","ignored_users":"Genegeerd","ignored_users_instructions":"Alle berichten en meldingen van deze gebruikers onderdrukken.","tracked_topics_link":"Tonen","automatically_unpin_topics":"Topics automatisch losmaken als ik de onderkant bereik","apps":"Apps","revoke_access":"Toegang intrekken","undo_revoke_access":"Toegang intrekken ongedaan maken","api_approved":"Goedgekeurd:","api_last_used_at":"Laatst gebruikt op:","theme":"Thema","home":"Standaard startpagina","staged":"Staged","staff_counters":{"flags_given":"behulpzame markeringen","flagged_posts":"gemarkeerde berichten","deleted_posts":"verwijderde berichten","suspensions":"schorsingen","warnings_received":"waarschuwingen","rejected_posts":"geweigerde berichten"},"messages":{"all":"Alle","inbox":"Postvak IN","sent":"Verzonden","archive":"Archief","groups":"Mijn groepen","bulk_select":"Berichten selecteren","move_to_inbox":"Verplaatsen naar Postvak IN","move_to_archive":"Archiveren","failed_to_move":"Het verplaatsen van geselecteerde berichten is niet gelukt (misschien is uw netwerkverbinding verbroken)","select_all":"Alles selecteren","tags":"Tags"},"preferences_nav":{"account":"Account","profile":"Profiel","emails":"E-mails","notifications":"Meldingen","categories":"Categorieën","users":"Gebruikers","tags":"Tags","interface":"Interface","apps":"Apps"},"change_password":{"success":"(e-mail verzonden)","in_progress":"(e-mail wordt verzonden)","error":"(fout)","emoji":"slot-emoji","action":"E-mail voor wachtwoordherinitialisatie verzenden","set_password":"Wachtwoord instellen","choose_new":"Kies een nieuw wachtwoord","choose":"Kies een wachtwoord"},"second_factor_backup":{"title":"Twee-factor-back-upcodes","regenerate":"Hergenereren ","disable":"Uitschakelen","enable":"Inschakelen","enable_long":"Back-upcodes inschakelen","manage":"Back-upcodes beheren. U hebt \u003cstrong\u003e{{count}}\u003c/strong\u003e back-upcodes over.","copied_to_clipboard":"Gekopieerd naar klembord","copy_to_clipboard_error":"Fout bij kopiëren van gegevens naar klembord","remaining_codes":"U hebt \u003cstrong\u003e{{count}}\u003c/strong\u003e back-upcodes over.","use":"Een back-upcode gebruiken","enable_prerequisites":"U moet een primaire tweede factor inschakelen voordat u back-upcodes genereert.","codes":{"title":"Back-upcodes gegenereerd","description":"Elke back-upcode kan maar één keer worden gebruikt. Bewaar ze op een veilige maar toegankelijke plek."}},"second_factor":{"title":"Twee-factor-authenticatie","enable":"Twee-factor-authenticatie beheren","forgot_password":"Wachtwoord vergeten?","confirm_password_description":"Bevestig uw wachtwoord om door te gaan","name":"Naam","label":"Code","rate_limit":"Wacht even voordat u een andere authenticatiecode probeert.","enable_description":"Scan deze QR-code in een ondersteunde app (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) en voer uw authenticatiecode in.\n","disable_description":"Voer de authenticatiecode van uw app in","show_key_description":"Voer handmatig in","short_description":"Bescherm uw account met beveiligingscodes voor eenmalig gebruik.\n","extended_description":"Twee-factor-authenticatie voegt extra beveiliging toe aan uw account door naast uw wachtwoord een eenmalige code te vereisen. Tokens kunnen op \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e- en \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e-apparaten worden gegenereerd.\n","oauth_enabled_warning":"Houd er rekening mee dat sociale aanmeldingen worden uitgeschakeld zodra twee-factor-authenticatie op uw account is ingeschakeld.","use":"Authenticator-app gebruiken","enforced_notice":"U dient twee-factor-authenticatie in te schakelen voordat u deze website bezoekt.","disable":"uitschakelen","disable_title":"Tweede factor uitschakelen","disable_confirm":"Weet u zeker dat u alle tweede factoren wilt uitschakelen?","edit":"Bewerken","edit_title":"Tweede factor bewerken","edit_description":"Naam van tweede factor","enable_security_key_description":"Houd uw fysieke beveiligingssleutel gereed en klik op de onderstaande knop Registreren.","totp":{"title":"Op tokens gebaseerde authenticators","add":"Nieuwe authenticator","default_name":"Mijn authenticator","name_and_code_required_error":"U moet een naam en de code van uw authenticator-app opgeven."},"security_key":{"register":"Registreren","title":"Beveiligingssleutels","add":"Beveiligingssleutel registreren","default_name":"Hoofdbeveiligingssleutel","not_allowed_error":"Het registratieproces van de beveiligingssleutel had een time-out of is geannuleerd.","already_added_error":"U hebt deze beveiligingssleutel al geregistreerd. U hoeft deze niet opnieuw te registreren.","edit":"Beveiligingssleutel bewerken","edit_description":"Naam van beveiligingssleutel","delete":"Verwijderen","name_required_error":"U moet een naam voor uw beveiligingssleutel opgeven."}},"change_about":{"title":"Over mij wijzigen","error":"Er is een fout opgetreden bij het wijzigen van deze waarde."},"change_username":{"title":"Gebruikersnaam wijzigen","confirm":"Weet u absoluut zeker dat u uw gebruikersnaam wilt wijzigen?","taken":"Sorry, maar die gebruikersnaam is al in gebruik.","invalid":"Die gebruikersnaam is ongeldig. Hij mag alleen cijfers en letters bevatten."},"change_email":{"title":"E-mailadres wijzigen","taken":"Sorry, dat e-mailadres is niet beschikbaar.","error":"Er is een fout opgetreden bij het wijzigen van uw e-mailadres. Misschien is dat adres al in gebruik?","success":"We hebben een e-mail naar dat adres gestuurd. Volg de instructies voor bevestiging.","success_staff":"Er is een e-mail naar uw huidige adres verzonden. Volg de bevestigingsinstructies."},"change_avatar":{"title":"Uw profielafbeelding wijzigen","gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e, gebaseerd op","gravatar_title":"Wijzig uw avatar op de website van {{gravatarName}}","gravatar_failed":"We konden geen {{gravatarName}} voor dat e-mailadres vinden.","refresh_gravatar_title":"Uw {{gravatarName}} vernieuwen","letter_based":"Door systeem toegekende profielafbeelding","uploaded_avatar":"Eigen afbeelding","uploaded_avatar_empty":"Een eigen afbeelding toevoegen","upload_title":"Uw afbeelding uploaden","image_is_not_a_square":"Waarschuwing: we hebben uw afbeelding bijgesneden; breedte en hoogte waren niet gelijk."},"change_profile_background":{"title":"Profielkoptekst","instructions":"Profielkopteksten worden gecentreerd en hebben een standaardbreedte van 1110px."},"change_card_background":{"title":"Achtergrond van gebruikerskaart","instructions":"Achtergrondafbeeldingen worden gecentreerd en hebben een standaardbreedte van 590px."},"change_featured_topic":{"title":"Aanbevolen topic","instructions":"Er wordt een koppeling naar dit topic op uw gebruikerskaart en profiel geplaatst."},"email":{"title":"E-mail","primary":"Primair e-mailadres","secondary":"Extra e-mailadressen","no_secondary":"Geen extra e-mailadressen","sso_override_instructions":"E-mailadres kan vanaf SSO-provider worden bijgewerkt.","instructions":"Nooit openbaar zichtbaar.","ok":"We sturen een e-mail ter bevestiging","invalid":"Voer een geldig e-mailadres in ","authenticated":"Uw e-mailadres is geauthenticeerd door {{provider}}","frequency_immediately":"Als u de inhoud in kwestie nog niet hebt gelezen, sturen we u direct een e-mail.","frequency":{"one":"We sturen alleen een e-mail als we u de laatste minuut niet hebben gezien.","other":"We sturen alleen een e-mail als we u de laatste {{count}} minuten niet hebben gezien."}},"associated_accounts":{"title":"Gekoppelde accounts","connect":"Verbinden","revoke":"Intrekken","cancel":"Annuleren","not_connected":"(niet gekoppeld)","confirm_modal_title":"%{provider}-account koppelen","confirm_description":{"account_specific":"Uw %{provider}-account '%{account_description}' wordt voor authenticatie gebruikt.","generic":"Uw %{provider}-account wordt voor authenticatie gebruikt."}},"name":{"title":"Naam","instructions":"uw volledige naam (optioneel)","instructions_required":"Uw volledige naam","too_short":"Uw naam is te kort","ok":"Uw naam ziet er goed uit"},"username":{"title":"Gebruikersnaam","instructions":"uniek, geen spaties, kort","short_instructions":"Mensen kunnen u vermelden als @{{username}}","available":"Uw gebruikersnaam is beschikbaar","not_available":"Niet beschikbaar. {{suggestion}} proberen?","not_available_no_suggestion":"Niet beschikbaar","too_short":"Uw gebruikersnaam is te kort","too_long":"Uw gebruikersnaam is te lang","checking":"Beschikbaarheid van gebruikersnaam controleren...","prefilled":"E-mailadres komt overeen met deze geregistreerde gebruikersnaam"},"locale":{"title":"Taal van interface","instructions":"Taal van de gebruikersinterface. Deze verandert zodra u de pagina opnieuw laadt.","default":"(standaard)","any":"alle"},"password_confirmation":{"title":"Nogmaals het wachtwoord"},"invite_code":{"title":"Uitnodigingscode","instructions":"Accountregistratie vereist een uitnodigingscode"},"auth_tokens":{"title":"Onlangs gebruikte apparaten","ip":"IP","details":"Details","log_out_all":"Alles afmelden","active":"nu actief","not_you":"Niet u?","show_all":"Alles tonen ({{count}})","show_few":"Minder tonen","was_this_you":"Was u dit?","was_this_you_description":"Als u dit niet was, raden we aan om uw wachtwoord te wijzigen en u overal af te melden.","browser_and_device":"{{browser}} op {{device}}","secure_account":"Mijn account beveiligen","latest_post":"Uw laatste bericht..."},"last_posted":"Laatste bericht","last_emailed":"Laatst gemaild","last_seen":"Gezien","created":"Lid sinds","log_out":"Afmelden","location":"Locatie","website":"Website","email_settings":"E-mail","hide_profile_and_presence":"Mijn openbare profiel en aanwezigheidsfuncties verbergen","enable_physical_keyboard":"Ondersteuning voor fysiek toetsenbord op iPad inschakelen","text_size":{"title":"Tekstgrootte","smaller":"Kleiner","normal":"Normaal","larger":"Groter","largest":"Grootst"},"title_count_mode":{"title":"Titel van achtergrondpagina geeft dit aantal weer:","notifications":"Nieuwe meldingen","contextual":"Nieuwe pagina-inhoud"},"like_notification_frequency":{"title":"Melden wanneer geliket","always":"Altijd","first_time_and_daily":"De eerste keer dat een bericht is geliket en dagelijks","first_time":"De eerste keer dat een bericht is geliket","never":"Nooit"},"email_previous_replies":{"title":"Vorige antwoorden onder e-mails bijvoegen","unless_emailed":"tenzij eerder verzonden","always":"altijd","never":"nooit"},"email_digests":{"title":"Als ik hier niet kom, mij een e-mailsamenvatting van populaire topics en antwoorden sturen","every_30_minutes":"elke 30 minuten","every_hour":"elk uur","daily":"dagelijks","weekly":"wekelijks","every_month":"elke maand","every_six_months":"elke zes maanden"},"email_level":{"title":"Mij een e-mail sturen wanneer iemand mij citeert, op mijn bericht antwoordt, mijn @gebruikersnaam vermeldt, of mij voor een topic uitnodigt","always":"altijd","only_when_away":"alleen wanneer afwezig","never":"nooit"},"email_messages_level":"Mij een e-mail sturen wanneer iemand mij een bericht stuurt","include_tl0_in_digests":"Bijdragen van nieuwe gebruikers in e-mailsamenvattingen bijvoegen","email_in_reply_to":"Fragment van antwoord op bericht in e-mails bijvoegen","other_settings":"Overige","categories_settings":"Categorieën","new_topic_duration":{"label":"Topics als nieuw beschouwen wanneer","not_viewed":"ik ze nog niet heb bekeken","last_here":"ze sinds mijn laatste bezoek zijn aangemaakt","after_1_day":"ze de afgelopen dag zijn aangemaakt","after_2_days":"ze de afgelopen 2 dagen zijn aangemaakt","after_1_week":"ze de afgelopen week zijn aangemaakt","after_2_weeks":"ze de afgelopen 2 weken zijn aangemaakt"},"auto_track_topics":"Automatisch topics volgen die ik heb bezocht","auto_track_options":{"never":"nooit","immediately":"direct","after_30_seconds":"na 30 seconden","after_1_minute":"na 1 minuut","after_2_minutes":"na 2 minuten","after_3_minutes":"na 3 minuten","after_4_minutes":"na 4 minuten","after_5_minutes":"na 5 minuten","after_10_minutes":"na 10 minuten"},"notification_level_when_replying":"Als ik een bericht in een topic plaats, dat topic instellen op","invited":{"search":"typ om uitnodigingen te zoeken...","title":"Uitnodigingen","user":"Uitgenodigde gebruiker","sent":"Laatst verzonden","none":"Geen uitnodigingen om weer te geven.","truncated":{"one":"De eerste uitnodiging wordt getoond.","other":"De eerste {{count}} uitnodigingen worden getoond."},"redeemed":"Verzilverde uitnodigingen","redeemed_tab":"Verzilverd","redeemed_tab_with_count":"Verzilverd ({{count}})","redeemed_at":"Verzilverd","pending":"Uitstaande uitnodigingen","pending_tab":"Uitstaand","pending_tab_with_count":"Uitstaand ({{count}})","topics_entered":"Topics bekeken","posts_read_count":"Berichten gelezen","expired":"Deze uitnodiging is verlopen.","rescind":"Verwijderen","rescinded":"Uitnodiging verwijderd","rescind_all":"Alle verlopen uitnodigingen verwijderen","rescinded_all":"Alle verlopen uitnodigingen verwijderd!","rescind_all_confirm":"Weet u zeker dat u alle verlopen uitnodigingen wilt verwijderen?","reinvite":"Uitnodiging opnieuw versturen","reinvite_all":"Alle uitnodigingen opnieuw versturen","reinvite_all_confirm":"Weet u zeker dat u alle uitnodigingen opnieuw wilt versturen?","reinvited":"Uitnodiging opnieuw verstuurd","reinvited_all":"Alle uitnodigingen zijn opnieuw verstuurd!","time_read":"Leestijd","days_visited":"Dagen bezocht","account_age_days":"Leeftijd van account in dagen","create":"Een uitnodiging versturen","generate_link":"Uitnodigingskoppeling kopiëren","link_generated":"Uitnodigingskoppeling is aangemaakt!","valid_for":"De uitnodigingskoppeling is alleen geldig voor dit e-mailadres: %{email}","bulk_invite":{"none":"U hebt hier nog niemand uitgenodigd. Stuur individuele uitnodigingen of nodig meerdere mensen tegelijk uit door \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eeen CSV-bestand te uploaden\u003c/a\u003e.","text":"Bulkuitnodiging vanuit bestand","success":"Het bestand is geüpload. U ontvangt een melding via een bericht zodra het proces is voltooid.","error":"Sorry, bestand dient de CSV-indeling te hebben.","confirmation_message":"U gaat uitnodigingen naar iedereen in het geüploade bestand e-mailen"}},"password":{"title":"Wachtwoord","too_short":"Uw wachtwoord is te kort.","common":"Dat wachtwoord wordt al te vaak gebruikt.","same_as_username":"Uw wachtwoord is hetzelfde als uw gebruikersnaam.","same_as_email":"Uw wachtwoord is hetzelfde als uw e-mailadres.","ok":"Uw wachtwoord ziet er goed uit.","instructions":"minstens %{count} tekens"},"summary":{"title":"Samenvatting ","stats":"Statistieken ","time_read":"leestijd","recent_time_read":"recente leestijd","topic_count":{"one":"Onderwerp gemaakt","other":"topics gemaakt"},"post_count":{"one":"bericht gemaakt","other":"berichten gemaakt"},"likes_given":{"one":"gegeven","other":"gegeven"},"likes_received":{"one":"ontvangen","other":"ontvangen"},"days_visited":{"one":"dag bezocht","other":"dagen bezocht"},"topics_entered":{"one":"topic bekeken","other":"topics bekeken"},"posts_read":{"one":"bericht gelezen","other":"berichten gelezen"},"bookmark_count":{"one":"favoriet","other":"bladwijzers"},"top_replies":"Topantwoorden","no_replies":"Nog geen antwoorden.","more_replies":"Meer antwoorden","top_topics":"Toptopics","no_topics":"Nog geen topics.","more_topics":"Meer topics","top_badges":"Topbadges","no_badges":"Nog geen badges.","more_badges":"Meer badges","top_links":"Topkoppelingen","no_links":"Nog geen koppelingen.","most_liked_by":"Meest geliket door","most_liked_users":"Meest geliket","most_replied_to_users":"Meest geantwoord op","no_likes":"Nog geen likes.","top_categories":"Topcategorieën","topics":"Topics","replies":"Antwoorden"},"ip_address":{"title":"Laatste IP-adres"},"registration_ip_address":{"title":"IP-adres bij registratie"},"avatar":{"title":"Profielafbeelding","header_title":"profiel, berichten, bladwijzers en voorkeuren"},"title":{"title":"Titel","none":"(geen)"},"primary_group":{"title":"Primaire groep","none":"(geen)"},"filters":{"all":"Alle"},"stream":{"posted_by":"Geplaatst door","sent_by":"Verzonden door","private_message":"bericht","the_topic":"het topic"}},"loading":"Laden...","errors":{"prev_page":"tijdens het laden van","reasons":{"network":"Netwerkfout","server":"Serverfout","forbidden":"Toegang geweigerd","unknown":"Fout","not_found":"Pagina niet gevonden"},"desc":{"network":"Controleer uw verbinding.","network_fixed":"De verbinding lijkt te zijn hersteld.","server":"Foutcode: {{status}}","forbidden":"U mag dat niet bekijken.","not_found":"Oeps, de toepassing heeft geprobeerd een URL te laden die niet bestaat.","unknown":"Er is iets misgegaan."},"buttons":{"back":"Terug","again":"Opnieuw proberen","fixed":"Pagina laden"}},"modal":{"close":"sluiten","dismiss_error":"Fout negeren"},"close":"Sluiten","assets_changed_confirm":"Deze website is zojuist bijgewerkt. Nu vernieuwen om de nieuwste versie te laden?","logout":"U bent afgemeld.","refresh":"Vernieuwen","read_only_mode":{"enabled":"Deze website bevindt zich in alleen-lezenmodus. U kunt doorgaan met browsen, maar berichten beantwoorden, likes geven en andere acties zijn momenteel uitgeschakeld.","login_disabled":"Aanmelden is uitgeschakeld zolang de website zich in alleen-lezenmodus bevindt.","logout_disabled":"Afmelden is uitgeschakeld zolang de website zich in alleen-lezenmodus bevindt."},"logs_error_rate_notice":{},"learn_more":"meer info...","all_time":"totaal","all_time_desc":"aantal aangemaakte topics","year":"jaar","year_desc":"in de afgelopen 365 dagen aangemaakte topics","month":"maand","month_desc":"in de afgelopen 30 dagen aangemaakte topics","week":"week","week_desc":"in de afgelopen 7 dagen aangemaakte topics","day":"dag","first_post":"Eerste bericht","mute":"Negeren","unmute":"Tonen","last_post":"Geplaatst","time_read":"Gelezen","time_read_recently":"%{time_read} onlangs","time_read_tooltip":"%{time_read} totale leestijd","time_read_recently_tooltip":"%{time_read} totale leestijd (%{recent_time_read} in de afgelopen 60 dagen)","last_reply_lowercase":"laatste antwoord","replies_lowercase":{"one":"antwoord","other":"antwoorden"},"signup_cta":{"sign_up":"Registreren","hide_session":"Mij morgen herinneren","hide_forever":"nee, bedankt","hidden_for_session":"OK, ik vraag het u morgen. U kunt ook altijd 'Aanmelden' gebruiken om een account aan te maken.","intro":"Hallo! Zo te zien beleeft u plezier aan de discussie, maar hebt u zich nog niet voor een account geregistreerd.","value_prop":"Als u een account aanmaakt, houden we precies bij wat u hebt gelezen, zodat u altijd kunt verdergaan waar u was gebleven. Ook ontvangt u meldingen bij nieuwe berichten zodra iemand antwoordt, hier en via e-mail, en kunt u berichten liken om uw passie te delen. :heartpulse:"},"summary":{"enabled_description":"U bekijkt een samenvatting van dit topic: de meeste interessante berichten zoals bepaald door de gemeenschap.","description":"Er zijn \u003cb\u003e{{replyCount}}\u003c/b\u003e antwoorden.","description_time":"Er zijn \u003cb\u003e{{replyCount}}\u003c/b\u003e antwoorden met een geschatte leestijd van \u003cb\u003e{{readingTime}} minuten\u003c/b\u003e.","enable":"Dit topic samenvatten","disable":"Alle berichten tonen"},"deleted_filter":{"enabled_description":"Dit topic bevat verwijderde berichten, die zijn verborgen.","disabled_description":"Verwijderde berichten in het topic worden getoond.","enable":"Verwijderde berichten verbergen","disable":"Verwijderde berichten tonen"},"private_message_info":{"title":"Bericht","invite":"Anderen uitnodigen ...","edit":"Toevoegen of verwijderen ...","leave_message":"Weet u zeker dat u dit bericht wilt verlaten?","remove_allowed_user":"Wilt u {{naam}} echt uit dit bericht verwijderen?","remove_allowed_group":"Wilt u {{name}} echt uit dit bericht verwijderen?"},"email":"E-mailadres","username":"Gebruikersnaam","last_seen":"Gezien","created":"Gemaakt","created_lowercase":"gemaakt","trust_level":"Vertrouwensniveau","search_hint":"gebruikersnaam, e-mailadres of IP-adres","create_account":{"disclaimer":"Door te registreren gaat u akkoord met het \u003ca href='{{privacy_link}}' target='blank'\u003eprivacybeleid\u003c/a\u003e en de \u003ca href='{{tos_link}}' target='blank'\u003eservicevoorwaarden\u003c/a\u003e.","title":"Nieuwe account maken","failed":"Er is iets misgegaan; mogelijk is het e-mailadres al geregistreerd. Probeer de koppeling 'Wachtwoord vergeten'."},"forgot_password":{"title":"Wachtwoord herinitialiseren","action":"Ik ben mijn wachtwoord vergeten","invite":"Voer uw gebruikersnaam of e-mailadres in, en we sturen u een e-mail om uw wachtwoord opnieuw in te stellen.","reset":"Wachtwoord herinitialiseren","complete_username":"Als er een account met de gebruikersnaam \u003cb\u003e%{username}\u003cb/\u003e overeenkomt, zou u spoedig een e-mail moeten ontvangen met instructies om uw wachtwoord opnieuw in te stellen.","complete_email":"Als er een account met het e-mailadres \u003cb\u003e%{email}\u003cb/\u003e overeenkomt, zou u spoedig een e-mail moeten ontvangen met instructies om uw wachtwoord opnieuw in te stellen.","complete_username_found":"We hebben een account gevonden die met de gebruikersnaam \u003cb\u003e%{username}\u003c/b\u003e overeenkomt. U zou spoedig een e-mail moeten ontvangen met instructies om uw wachtwoord opnieuw in te stellen.","complete_email_found":"We hebben een account gevonden die met het e-mailadres \u003cb\u003e%{email}\u003c/b\u003e overeenkomt. U zou spoedig een e-mail moeten ontvangen met instructies om uw wachtwoord opnieuw in te stellen.","complete_username_not_found":"Geen account met de gebruikersnaam \u003cb\u003e%{username}\u003c/b\u003e gevonden","complete_email_not_found":"Geen account met het e-mailadres \u003cb\u003e%{email}\u003c/b\u003e gevonden","help":"Komt de e-mail niet aan? Controleer eerst uw spammap.\u003cp\u003eWeet u niet zeker welk e-mailadres u hebt gebruikt? Voer een e-mailadres in en we laten u weten of het hier bestaat.\u003c/p\u003e\u003cp\u003eAls u geen toegang meer hebt tot het e-mailadres van uw account, neem dan contact op met \u003ca href='%{basePath}/about'\u003eonze behulpzame staf.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Help"},"email_login":{"link_label":"Een koppeling voor aanmelding e-mailen","button_label":"via e-mail","emoji":"slot-emoji","complete_username":"Als een account overeenkomt met de gebruikersnaam \u003cb\u003e%{username}\u003c/b\u003e, zou u spoedig een e-mail met een koppeling voor aanmelding moeten ontvangen.","complete_email":"Als een account overeenkomt met \u003cb\u003e%{email}\u003c/b\u003e, zou u spoedig een e-mail met een koppeling voor aanmelding moeten ontvangen.","complete_username_found":"We hebben een account gevonden die overeenkomt met de gebruikersnaam \u003cb\u003e%{username}\u003c/b\u003e. U zou spoedig een e-mail met een koppeling voor aanmelding moeten ontvangen.","complete_email_found":"We hebben een account gevonden die overeenkomt met \u003cb\u003e%{email}\u003c/b\u003e. U zou spoedig een e-mail met een koppeling voor aanmelding moeten ontvangen.","complete_username_not_found":"Er komt geen account overeen met de gebruikersnaam \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Er komt geen account overeen met \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Doorgaan naar %{site_name}","logging_in_as":"Aanmelden als %{email}","confirm_button":"Aanmelding voltooien"},"login":{"title":"Aanmelden","username":"Gebruiker","password":"Wachtwoord","second_factor_title":"Twee-factor-authenticatie","second_factor_description":"Voer de authenticatiecode van uw app in:","second_factor_backup":"Aanmelden met een back-upcode","second_factor_backup_title":"Twee-factor-back-up","second_factor_backup_description":"Voer een van uw back-upcodes in:","second_factor":"Aanmelden met authenticator-app","security_key_description":"Houd uw fysieke beveiligingssleutel gereed en klik op de onderstaande knop Authenticeren met beveiligingssleutel.","security_key_alternative":"Andere manier proberen","security_key_authenticate":"Authenticeren met beveiligingssleutel","security_key_not_allowed_error":"Het authenticatieproces van de beveiligingssleutel had een time-out of is geannuleerd.","security_key_no_matching_credential_error":"Geen referenties gevonden in de opgegeven beveiligingssleutel.","security_key_support_missing_error":"Uw huidige apparaat of browser ondersteunt geen gebruik van beveiligingssleutels. Gebruik een andere methode.","email_placeholder":"e-mailadres of gebruikersnaam","caps_lock_warning":"Caps Lock staat aan","error":"Onbekende fout","cookies_error":"Het lijkt erop dat uw browser geen cookies toestaat. Als u ze niet eerst toestaat, kunt u zich misschien niet aanmelden.","rate_limit":"Wacht even voordat u zich opnieuw probeert aan te melden.","blank_username":"Voer uw e-mailadres of gebruikersnaam in.","blank_username_or_password":"Voer uw e-mailadres of gebruikersnaam en wachtwoord in.","reset_password":"Wachtwoord herinitialiseren","logging_in":"Aanmelden...","or":"Of","authenticating":"Authenticeren...","awaiting_activation":"Uw account wacht op activering; gebruik de koppeling 'Wachtwoord vergeten' om een nieuwe activeringsmail te ontvangen.","awaiting_approval":"Uw account is nog niet door een staflid goedgekeurd. U ontvangt een e-mail zodra dat is gebeurd.","requires_invite":"Sorry, toegang tot dit forum werkt alleen via uitnodiging.","not_activated":"U kunt zich nog niet aanmelden. We hebben een activeringsmail naar \u003cb\u003e{{sentTo}}\u003c/b\u003e gestuurd. Volg de instructies in dat e-mailbericht om uw account te activeren.","not_allowed_from_ip_address":"U kunt zich niet aanmelden vanaf dat IP-adres.","admin_not_allowed_from_ip_address":"U kunt zich niet aanmelden als beheerder vanaf dat IP-adres.","resend_activation_email":"Klik hier om de activeringsmail opnieuw te versturen.","omniauth_disallow_totp":"Uw account heeft twee-factor-authenticatie ingeschakeld. Meld u aan met uw wachtwoord.","resend_title":"Activeringsmail opnieuw versturen","change_email":"E-mailadres wijzigen","provide_new_email":"Geef een nieuw adres op en we sturen uw bevestigingsmail opnieuw.","submit_new_email":"E-mailadres bijwerken","sent_activation_email_again":"We hebben een nieuwe activeringsmail naar \u003cb\u003e{{currentEmail}}\u003c/b\u003e gestuurd. Het kan een aantal minuten duren voor deze aankomt; controleer ook uw spammap.","sent_activation_email_again_generic":"We hebben nog een activeringsmail gestuurd. Het kan een aantal minuten duren voordat deze aankomt; controleer ook uw spammap.","to_continue":"Meld u aan","preferences":"U dient aangemeld te zijn om uw gebruikersvoorkeuren te wijzigen.","forgot":"Ik kan me de details van mijn gebruikersaccount niet herinneren.","not_approved":"Uw account is nog niet goedgekeurd. U ontvangt een melding via e-mail zodra u zich kunt aanmelden.","google_oauth2":{"name":"Google","title":"met Google"},"twitter":{"name":"Twitter","title":"met Twitter"},"instagram":{"name":"Instagram","title":"met Instagram"},"facebook":{"name":"Facebook","title":"met Facebook"},"github":{"name":"GitHub","title":"met GitHub"},"discord":{"name":"Discord","title":"met Discord"},"second_factor_toggle":{"totp":"Een authenticator-app gebruiken","backup_code":"Een back-upcode gebruiken"}},"invites":{"accept_title":"Uitnodiging","emoji":"envelop-emoji","welcome_to":"Welkom bij %{site_name}!","invited_by":"U bent uitgenodigd door:","social_login_available":"U kunt zich ook aanmelden met een willekeurige sociale aanmelding die dat e-mailadres gebruikt.","your_email":"Het e-mailadres van uw account is \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Uitnodiging accepteren","success":"Uw account is gemaakt en u bent nu aangemeld.","name_label":"Naam","password_label":"Wachtwoord instellen","optional_description":"(optioneel)"},"password_reset":{"continue":"Doorgaan naar %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (voorheen EmojiOne)","win10":"Win10","google_classic":"Google Klassiek","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Alleen categorieën","categories_with_featured_topics":"Categorieën met aanbevolen topics","categories_and_latest_topics":"Categorieën en nieuwste topics","categories_and_top_topics":"Categorieën en toptopics","categories_boxes":"Vakken met subcategorieën","categories_boxes_with_topics":"Vakken met aanbevolen topics"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Enter"},"conditional_loading_section":{"loading":"Laden..."},"category_row":{"topic_count":"{{count}} topics in deze categorie"},"select_kit":{"default_header_text":"Selecteren...","no_content":"Geen overeenkomsten gevonden","filter_placeholder":"Zoeken...","filter_placeholder_with_any":"Zoeken of aanmaken...","create":"Aanmaken: '{{content}}'","max_content_reached":{"one":"U kunt maar {{count}} item selecteren.","other":"U kunt maar {{count}} items selecteren."},"min_content_not_reached":{"one":"Selecteer minstens {{count}} item.","other":"Selecteer minstens {{count}} items."},"invalid_selection_length":"Selectie moet minstens {{count}} tekens bevatten."},"date_time_picker":{"from":"Van","to":"Aan","errors":{"to_before_from":"Tot-datum moet later zijn dan van-datum."}},"emoji_picker":{"filter_placeholder":"Zoeken naar emoji","smileys_\u0026_emotion":"Smileys en Emotie","people_\u0026_body":"Mensen en Lichaam","animals_\u0026_nature":"Dieren en Natuur","food_\u0026_drink":"Eten en Drinken","travel_\u0026_places":"Reizen en Plaatsen","activities":"Activiteiten","objects":"Objecten","symbols":"Symbolen","flags":"Vlaggen","recent":"Onlangs gebruikt","default_tone":"Geen huidskleur","light_tone":"Lichte huidskleur","medium_light_tone":"Licht gemiddelde huidskleur","medium_tone":"Gemiddelde huidskleur","medium_dark_tone":"Donker gemiddelde huidskleur","dark_tone":"Donkere huidskleur","default":"Eigen emoji"},"shared_drafts":{"title":"Gedeelde concepten","notice":"Dit topic is alleen zichtbaar voor degenen die de categorie \u003cb\u003e{{category}}\u003c/b\u003e kunnen zien.","destination_category":"Bestemmingscategorie","publish":"Gedeeld concept publiceren","confirm_publish":"Weet u zeker dat u dit concept wilt publiceren?","publishing":"Topic publiceren..."},"composer":{"emoji":"Emoji :)","more_emoji":"meer...","options":"Opties","whisper":"fluisteren","unlist":"onzichtbaar","blockquote_text":"Citaat","add_warning":"Dit is een officiële waarschuwing.","toggle_whisper":"Fluistermodus in-/uitschakelen","toggle_unlisted":"Onzichtbaar in-/uitschakelen","posting_not_on_topic":"Op welk topic wilt u antwoorden?","saved_local_draft_tip":"lokaal opgeslagen","similar_topics":"Uw topic lijkt op...","drafts_offline":"concepten offline","edit_conflict":"bewerkingsconflict","group_mentioned_limit":"\u003cb\u003eWaarschuwing!\u003c/b\u003e U hebt \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e genoemd, maar deze groep heeft meer leden dan de door een beheerder geconfigureerde limiet van {{max}} gebruikers voor noemen. Niemand krijgt een melding. ","group_mentioned":{"one":"Door {{group}} te vermelden, gaat u \u003ca href='{{group_link}}'\u003e%{count} persoon\u003c/a\u003e op de hoogte brengen – weet u dit zeker?","other":"Door {{group}} te vermelden, gaat u \u003ca href='{{group_link}}'\u003e{{count}} personen\u003c/a\u003e op de hoogte brengen – weet u dit zeker?"},"cannot_see_mention":{"category":"U hebt {{username}} genoemd, maar de gebruiker ontvangt geen melding, omdat hij of zij geen toegang heeft tot deze categorie. U dient de gebruiker toe te voegen aan een groep die toegang heeft tot deze categorie.","private":"U hebt {{username}} genoemd, maar de gebruiker ontvangt geen melding, omdat hij of zij dit persoonlijke bericht niet kan zien. U dient de gebruiker voor dit PB uit te nodigen."},"duplicate_link":"Het lijkt erop dat uw koppeling naar \u003cb\u003e{{domain}}\u003c/b\u003e al in het topic is geplaatst door \u003cb\u003e@{{username}}\u003c/b\u003e in \u003ca href='{{post_url}}'\u003eeen antwoord op {{ago}}\u003c/a\u003e – weet u zeker dat u deze opnieuw wilt plaatsen?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Titel is vereist","title_too_short":"Titel moet minstens {{min}} tekens bevatten","title_too_long":"Titel kan niet langer zijn dan {{max}} tekens","post_missing":"Bericht kan niet leeg zijn","post_length":"Bericht moet minstens {{min}} tekens bevatten","try_like":"Hebt u de knop {{heart}} geprobeerd?","category_missing":"U moet een categorie kiezen","tags_missing":"U moet minstens {{count}} tags kiezen","topic_template_not_modified":"Voeg details en specifieke kenmerken toe aan uw topic door de topicsjabloon te bewerken."},"save_edit":"Bewerking opslaan","overwrite_edit":"Bewerking overschrijven","reply_original":"Antwoorden op oorspronkelijke topic","reply_here":"Hier antwoorden","reply":"Antwoorden","cancel":"Annuleren","create_topic":"Topic maken","create_pm":"Bericht","create_whisper":"Fluisteren","create_shared_draft":"Gedeeld concept maken","edit_shared_draft":"Gedeeld concept bewerken","title":"Of druk op Ctrl+Enter","users_placeholder":"Een gebruiker toevoegen","title_placeholder":"Waar gaat deze discussie over in één korte zin?","title_or_link_placeholder":"Typ de titel, of plak hier een koppeling","edit_reason_placeholder":"vanwaar deze bewerking?","topic_featured_link_placeholder":"Voer koppeling in die met titel wordt getoond.","remove_featured_link":"Koppeling uit topic verwijderen.","reply_placeholder":"Typ hier. Gebruik Markdown, BBCode of HTML voor opmaak. Sleep of plak afbeeldingen.","reply_placeholder_no_images":"Typ hier. Gebruik Markdown, BBCode of HTML voor opmaak.","reply_placeholder_choose_category":"Selecteer een categorie voordat u hier typt.","view_new_post":"Uw nieuwe bericht bekijken","saving":"Opslaan","saved":"Opgeslagen!","saved_draft":"Berichtconcept wordt uitgevoerd. Tik om te hervatten.","uploading":"Uploaden...","show_preview":"voorbeeld tonen \u0026raquo;","hide_preview":"\u0026laquo; voorbeeld verbergen","quote_post_title":"Hele bericht citeren","bold_label":"B","bold_title":"Vet","bold_text":"Vetgedrukte tekst","italic_label":"I","italic_title":"Cursief","italic_text":"Cursieve tekst","link_title":"Hyperlink","link_description":"voer hier een omschrijving in","link_dialog_title":"Hyperlink invoegen","link_optional_text":"optionele titel","link_url_placeholder":"Plak een URL of typ om topics te zoeken","quote_title":"Citaat","quote_text":"Citaat","code_title":"Vooraf opgemaakte tekst","code_text":"vooraf opgemaakte tekst met 4 spaties laten inspringen","paste_code_text":"typ of plak hier code","upload_title":"Uploaden","upload_description":"voer hier een omschrijving voor het uploaden in","olist_title":"Genummerde lijst","ulist_title":"Opsommingslijst","list_item":"Lijstitem","toggle_direction":"Richting omschakelen","help":"Hulp voor Markdown","collapse":"het editorpaneel minimaliseren","open":"het editorpaneel openen","abandon":"editor sluiten en concept verwijderen","enter_fullscreen":"editor in volledig scherm openen","exit_fullscreen":"editor in volledig scherm afsluiten","modal_ok":"OK","modal_cancel":"Annuleren","cant_send_pm":"Sorry, u kunt geen bericht naar %{username} sturen.","yourself_confirm":{"title":"Bent u ontvangers vergeten toe te voegen?","body":"Het bericht wordt nu alleen naar uzelf verstuurd!"},"admin_options_title":"Optionele stafinstellingen voor dit topic","composer_actions":{"reply":"Antwoorden","draft":"Concept","edit":"Bewerken","reply_to_post":{"label":"Antwoorden op bericht %{postNumber} van %{postUsername}","desc":"Antwoorden op een bepaald bericht"},"reply_as_new_topic":{"label":"Antwoorden als gekoppeld topic","desc":"Een nieuw topic maken dat aan dit topic is gekoppeld","confirm":"U hebt een nieuw-topicconcept opgeslagen, dat wordt overschreven als u een gekoppeld topic maakt."},"reply_as_private_message":{"label":"Nieuw bericht","desc":"Een nieuw persoonlijk bericht maken"},"reply_to_topic":{"label":"Antwoorden op topic","desc":"Antwoorden op het topic, niet een bepaald bericht"},"toggle_whisper":{"label":"Fluistermodus in-/uitschakelen","desc":"Fluisterberichten zijn alleen zichtbaar voor stafleden"},"create_topic":{"label":"Nieuw topic"},"shared_draft":{"label":"Gedeeld concept","desc":"Een concepttopic maken dat alleen zichtbaar is voor stafleden"},"toggle_topic_bump":{"label":"Topicbump in-/uitschakelen","desc":"Antwoorden zonder datum van laatste antwoord te wijzigen"}},"details_title":"Samenvatting","details_text":"Deze tekst wordt verborgen"},"notifications":{"tooltip":{"regular":{"one":"%{count} ongeziene melding","other":"{{count}} ongeziene meldingen"},"message":{"one":"%{count} ongelezen bericht","other":"{{count}} ongelezen berichten"},"high_priority":{"one":"%{count} ongelezen melding met hoge prioriteit","other":"%{count} ongelezen meldingen met hoge prioriteit"}},"title":"meldingen van @naam-vermeldingen, antwoorden op uw berichten en topics, berichten, etc.","none":"Meldingen kunnen momenteel niet worden geladen.","empty":"Geen meldingen gevonden.","post_approved":"Uw bericht is goedgekeurd","reviewable_items":"items die beoordeling nodig hebben","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} en %{count} anderen\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} en {{count}} anderen\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"heeft {{count}} van uw berichten geliket","other":"heeft {{count}} van uw berichten geliket"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e heeft uw uitnodiging geaccepteerd","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e heeft {{description}} verplaatst","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"'{{description}}' ontvangen","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNieuw Topic\u003c/span\u003e {{description}}","membership_request_accepted":"Lidmaatschap geaccepteerd in '{{group_name}}'","membership_request_consolidated":"{{count}} open lidmaatschapsaanvragen voor '{{group_name}}'","group_message_summary":{"one":"{{count}} bericht in uw Postvak IN voor {{group_name}}","other":"{{count}} berichten in uw Postvak IN voor {{group_name}}"},"popup":{"mentioned":"{{username}} heeft u genoemd in '{{topic}}' - {{site_title}}","group_mentioned":"{{username}} heeft u genoemd in '{{topic}}' - {{site_title}}","quoted":"{{username}} heeft u geciteerd in '{{topic}}' - {{site_title}}","replied":"{{username}} heeft op u geantwoord in '{{topic}}' - {{site_title}}","posted":"{{username}} heeft een bericht geplaatst in '{{topic}}' - {{site_title}}","private_message":"{{username}} heeft u een persoonlijk bericht gestuurd in '{{topic}}' - {{site_title}}","linked":"{{username}} heeft een koppeling naar uw bericht geplaatst vanaf '{{topic}}' - {{site_title}}","watching_first_post":"{{username}} heeft een nieuw topic gemaakt: '{{topic}}' - {{site_title}}","confirm_title":"Meldingen ingeschakeld - %{site_title}","confirm_body":"Gelukt! Meldingen zijn ingeschakeld.","custom":"Melding van {{username}} op %{site_title}"},"titles":{"mentioned":"genoemd","replied":"nieuw antwoord","quoted":"geciteerd","edited":"bewerkt","liked":"nieuwe like","private_message":"nieuw privébericht","invited_to_private_message":"uitgenodigd voor privébericht","invitee_accepted":"uitnodiging geaccepteerd","posted":"nieuw bericht","moved_post":"bericht verplaatst","linked":"gekoppeld","bookmark_reminder":"bladwijzerherinnering","bookmark_reminder_with_name":"bladwijzerherinnering - %{name}","granted_badge":"badge toegekend","invited_to_topic":"uitgenodigd voor topic","group_mentioned":"groep genoemd","group_message_summary":"nieuwe groepsberichten","watching_first_post":"nieuw topic","topic_reminder":"topic-herinnering","liked_consolidated":"nieuwe likes","post_approved":"bericht goedgekeurd","membership_request_consolidated":"nieuwe lidmaatschapsaanvragen"}},"upload_selector":{"title":"Een afbeelding toevoegen","title_with_attachments":"Een afbeelding of bestand toevoegen","from_my_computer":"Vanaf mijn apparaat","from_the_web":"Vanaf het web","remote_tip":"koppeling naar afbeelding","remote_tip_with_attachments":"koppeling naar afbeelding of bestand {{authorized_extensions}}","local_tip":"selecteer afbeeldingen vanaf uw apparaat","local_tip_with_attachments":"selecteer afbeeldingen of bestanden vanaf uw apparaat {{authorized_extensions}}","hint":"(u kunt ook afbeeldingen naar de editor slepen om deze te uploaden)","hint_for_supported_browsers":"u kunt ook afbeeldingen naar de editor slepen of hierin plakken","uploading":"Uploaden","select_file":"Bestand selecteren","default_image_alt_text":"afbeelding"},"search":{"sort_by":"Sorteren op","relevance":"Relevantie","latest_post":"Nieuwste bericht","latest_topic":"Nieuwste topic","most_viewed":"Meest bekeken","most_liked":"Meest geliket","select_all":"Alles selecteren","clear_all":"Alles wissen","too_short":"Uw zoekterm is te kort.","result_count":{"one":"\u003cspan\u003e%{count} resultaat voor\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} resultaten voor\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"zoeken naar topics, berichten, gebruikers of categorieën","full_page_title":"zoeken naar topics of berichten","no_results":"Geen resultaten gevonden.","no_more_results":"Geen resultaten meer gevonden.","searching":"Zoeken...","post_format":"#{{post_number}} door {{username}}","results_page":"Zoekresultaten voor '{{term}}'","more_results":"Er zijn meer resultaten. Verfijn uw zoekcriteria.","cant_find":"Kunt u niet vinden wat u zoekt?","start_new_topic":"Misschien een nieuw topic starten?","or_search_google":"Of probeer in plaats hiervan te zoeken met Google:","search_google":"Probeer in plaats hiervan te zoeken met Google:","search_google_button":"Google","search_google_title":"Zoeken op deze website","context":{"user":"Berichten van @{{username}} doorzoeken","category":"De categorie #{{category}} doorzoeken","tag":"De tag #{{tag}} doorzoeken","topic":"Dit topic doorzoeken","private_messages":"Berichten doorzoeken"},"advanced":{"title":"Geavanceerd zoeken","posted_by":{"label":"Geplaatst door"},"in_category":{"label":"Gecategoriseerd"},"in_group":{"label":"In groep"},"with_badge":{"label":"Met badge"},"with_tags":{"label":"Getagd"},"filters":{"label":"Alleen topics/berichten weergeven...","title":"Die alleen met de titel overeenkomen","likes":"die ik heb geliket","posted":"waarin ik iets heb geplaatst","created":"die ik heb aangemaakt","watching":"die ik in de gaten houd","tracking":"die ik volg","private":"In mijn berichten","bookmarks":"Ik heb een bladwijzer aangemaakt","first":"die het eerste bericht zijn","pinned":"die zijn vastgemaakt","unpinned":"die niet zijn vastgemaakt","seen":"Ik heb gelezen","unseen":"die ik niet heb gelezen","wiki":"die een wiki zijn","images":"die afbeelding(en) bevatten","all_tags":"Alle bovenstaande tags"},"statuses":{"label":"Waarin topics","open":"open zijn","closed":"gesloten zijn","public":"openbaar zijn","archived":"gearchiveerd zijn","noreplies":"geen antwoorden bevatten","single_user":"maar één gebruiker bevatten"},"post":{"count":{"label":"Minimaal berichtaantal"},"time":{"label":"Geplaatst","before":"voor","after":"na"}}}},"hamburger_menu":"naar een andere topiclijst of categorie","new_item":"nieuw","go_back":"terug","not_logged_in_user":"gebruikerspagina met samenvatting van huidige activiteit en voorkeuren","current_user":"naar uw gebruikerspagina","view_all":"alle bekijken","topics":{"new_messages_marker":"laatste bezoek","bulk":{"select_all":"Alles selecteren","clear_all":"Alles wissen","unlist_topics":"Topics onzichtbaar maken","relist_topics":"Topics opnieuw weergeven","reset_read":"Markeren als ongelezen","delete":"Topics verwijderen","dismiss":"Negeren","dismiss_read":"Alle ongelezen negeren","dismiss_button":"Negeren...","dismiss_tooltip":"Alleen nieuwe berichten negeren of het volgen van topics stoppen","also_dismiss_topics":"Het volgen van deze topics stoppen, zodat ze nooit meer als ongelezen verschijnen.","dismiss_new":"Nieuwe berichten negeren","toggle":"bulkselectie van topics in-/uitschakelen","actions":"Bulkacties","change_category":"Categorie wijzigen","close_topics":"Topics sluiten","archive_topics":"Topics archiveren","notification_level":"Meldingen","choose_new_category":"Kies de nieuwe categorie voor de topics:","selected":{"one":"U hebt \u003cb\u003e%{count}\u003c/b\u003e topic geselecteerd.","other":"U hebt \u003cb\u003e{{count}}\u003c/b\u003e topics geselecteerd."},"change_tags":"Tags vervangen","append_tags":"Tags toevoegen","choose_new_tags":"Kies nieuwe tags voor deze topics:","choose_append_tags":"Kies nieuwe tags om voor deze topics toe te voegen:","changed_tags":"De tags van deze topics zijn gewijzigd."},"none":{"unread":"U hebt geen ongelezen topics.","new":"U hebt geen nieuwe topics.","read":"U hebt nog geen topics gelezen.","posted":"U hebt nog niet in een topic gereageerd.","latest":"Er zijn geen nieuwste topics. Dat is jammer.","bookmarks":"U hebt nog geen bladwijzers voor topics gemaakt.","category":"Er zijn geen topics in {{category}}.","top":"Er zijn geen toptopics.","educate":{"new":"\u003cp\u003eHier verschijnen uw nieuwe topics.\u003c/p\u003e\u003cp\u003e Standaard worden topics als nieuw beschouwd en verschijnt de indicator \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enieuw\u003c/span\u003e als deze de afgelopen 2 dagen zijn aangemaakt.\u003c/p\u003e\u003cp\u003eBezoek uw \u003ca href=\"%{userPrefsUrl}\"\u003evoorkeuren\u003c/a\u003e om dit te wijzigen.\u003c/p\u003e","unread":"\u003cp\u003eHier verschijnen uw ongelezen topics.\u003c/p\u003e\u003cp\u003eStandaard worden topics als ongelezen beschouwd en verschijnt het aantal ongelezen \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e als u:\u003c/p\u003e\u003cul\u003e\u003cli\u003eHet topic hebt aangemaakt\u003c/li\u003e\u003cli\u003eOp het topic hebt geantwoord\u003c/li\u003e\u003cli\u003eHet topic langer dan 4 minuten hebt gelezen\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eOf als u het topic expliciet op Gevolgd of In de gaten gehouden hebt gezet via de meldingsinstellingen onder elk topic.\u003c/p\u003e\u003cp\u003eBezoek uw \u003ca href=\"%{userPrefsUrl}\"\u003evoorkeuren\u003c/a\u003e om dit te wijzigen.\u003c/p\u003e"}},"bottom":{"latest":"Er zijn geen nieuwste topics meer.","posted":"Er zijn geen topics meer geplaatst.","read":"Er zijn geen gelezen topics meer.","new":"Er zijn geen nieuwe topics meer.","unread":"Er zijn geen ongelezen topics meer.","category":"Er zijn geen topics meer in {{category}}.","top":"Er zijn geen toptopics meer.","bookmarks":"Er zijn geen topics met bladwijzers meer."}},"topic":{"filter_to":{"one":"%{count} bericht in topic","other":"{{count}} berichten in topic"},"create":"Nieuw topic","create_long":"Een nieuw topic maken","open_draft":"Concept openen","private_message":"Een bericht sturen","archive_message":{"help":"Bericht naar uw archief verplaatsen","title":"Archiveren "},"move_to_inbox":{"title":"Verplaatsen naar Postvak IN","help":"Bericht weer naar Postvak IN verplaatsen"},"edit_message":{"help":"Het eerste bericht van het bericht bewerken","title":"Bericht bewerken"},"defer":{"help":"Markeren als ongelezen","title":"Negeren"},"feature_on_profile":{"help":"Een koppeling naar dit topic toevoegen op uw gebruikerskaart en profiel","title":"Aanbevelen op profiel"},"remove_from_profile":{"warning":"Uw profiel heeft al een aanbevolen topic. Als u doorgaat, vervangt dit topic het bestaande topic.","help":"De koppeling naar dit topic op uw gebruikersprofiel verwijderen","title":"Verwijderen uit profiel"},"list":"Topics","new":"nieuw topic","unread":"ongelezen","new_topics":{"one":"%{count} nieuw topic","other":"{{count}} nieuwe topics"},"unread_topics":{"one":"%{count} ongelezen topic","other":"{{count}} ongelezen topics"},"title":"Topic","invalid_access":{"title":"Topic is privé","description":"Sorry, u hebt geen toegang tot dat topic!","login_required":"U dient zich aan te melden om dat topic te zien."},"server_error":{"title":"Laden van topic is mislukt","description":"Sorry, we konden dit topic niet laden, mogelijk door een verbindingsprobleem. Probeer het opnieuw. Als het probleem zich blijft voordoen, laat het ons dan weten."},"not_found":{"title":"Topic niet gevonden","description":"Sorry, we konden het opgevraagde topic niet vinden. Misschien is het verwijderd door een moderator?"},"total_unread_posts":{"one":"u hebt %{count} ongelezen bericht in dit topic","other":"u hebt {{count}} ongelezen berichten in dit topic"},"unread_posts":{"one":"u hebt %{count} ongelezen bericht in dit topic","other":"u hebt {{count}} ongelezen berichten in dit topic"},"new_posts":{"one":"er is %{count} nieuw bericht in dit topic sinds u het voor het laatst hebt gelezen","other":"er zijn {{count}} nieuwe berichten in dit topic sinds u het voor het laatst hebt gelezen"},"likes":{"one":"er is %{count} like in dit topic","other":"er zijn {{likes}} likes in dit topic"},"back_to_list":"Terug naar topiclijst","options":"Topic-opties","show_links":"koppelingen binnen dit topic tonen","toggle_information":"topicdetails in-/uitschakelen","read_more_in_category":"Wilt u meer lezen? U kunt door andere topics in {{catLink}} bladeren, of de {{latestLink}}.","read_more":"Wilt u meer lezen? {{catLink}} of {{latestLink}}.","group_request":"U dient lidmaatschap voor de groep `{{name}}` aan te vragen om dit topic te zien","group_join":"U dient lid van de groep `{{name}}` te zijn om dit topic te zien","group_request_sent":"Uw lidmaatschapsaanvraag voor de groep is verstuurd. U ontvangt een melding zodra deze is geaccepteerd.","unread_indicator":"Nog geen enkel lid heeft het laatste bericht van dit topic gelezen.","browse_all_categories":"Alle categorieën bekijken","view_latest_topics":"nieuwste topics bekijken","suggest_create_topic":"Waarom maakt u geen topic aan?","jump_reply_up":"naar eerder antwoord springen","jump_reply_down":"naar later antwoord springen","deleted":"Het topic is verwijderd","topic_status_update":{"title":"Topictimer","save":"Timer instellen","num_of_hours":"Aantal uren:","num_of_days":"Aantal dagen:","remove":"Timer verwijderen","publish_to":"Publiceren naar:","when":"Wanneer:","public_timer_types":"Topictimers","private_timer_types":"Gebruikerstopictimers","time_frame_required":"Selecteer een tijdsbestek"},"auto_update_input":{"none":"Selecteer een tijdsbestek","later_today":"Later vandaag","tomorrow":"Morgen","later_this_week":"Later deze week","this_weekend":"Dit weekend","next_week":"Volgende week","two_weeks":"Twee weken","next_month":"Volgende maand","two_months":"Twee maanden","three_months":"Drie maanden","four_months":"Vier maanden","six_months":"Zes maanden","one_year":"Eén jaar","forever":"Voor altijd","pick_date_and_time":"Kies datum en tijd","set_based_on_last_post":"Sluiten op basis van laatste bericht"},"publish_to_category":{"title":"Publicatie plannen"},"temp_open":{"title":"Tijdelijk openen"},"auto_reopen":{"title":"Topic automatisch openen"},"temp_close":{"title":"Tijdelijk sluiten"},"auto_close":{"title":"Topic automatisch sluiten","label":"Tijden voor automatisch sluiten van topic:","error":"Voer een geldige waarde in.","based_on_last_post":"Pas sluiten als het laatste bericht in het topic minstens zo oud is"},"auto_delete":{"title":"Topic automatisch verwijderen"},"auto_bump":{"title":"Topic automatisch bumpen"},"reminder":{"title":"Mij herinneren"},"auto_delete_replies":{"title":"Antwoorden automatisch verwijderen"},"status_update_notice":{"auto_open":"Dit topic wordt %{timeLeft} automatisch geopend.","auto_close":"Dit topic wordt %{timeLeft} automatisch gesloten.","auto_publish_to_category":"Dit topic wordt %{timeLeft} naar \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e gepubliceerd.","auto_close_based_on_last_post":"Dit topic wordt %{duration} na het laatste antwoord gesloten.","auto_delete":"Dit topic wordt %{timeLeft} automatisch verwijderd.","auto_bump":"Dit topic wordt %{timeLeft} automatisch gebumpt.","auto_reminder":"U wordt %{timeLeft} aan dit topic herinnerd.","auto_delete_replies":"Antwoorden op dit topic worden na %{duration} automatisch verwijderd."},"auto_close_title":"Instellingen voor automatisch sluiten","auto_close_immediate":{"one":"Het laatste bericht in dit topic is al %{count} uur oud, dus het topic wordt meteen gesloten.","other":"Het laatste bericht in dit topic is al %{count} uur oud, dus het topic wordt meteen gesloten."},"timeline":{"back":"Terug","back_description":"Terug naar uw laatste ongelezen bericht","replies_short":"%{current} / %{total}"},"progress":{"title":"topicvoortgang","go_top":"boven","go_bottom":"onder","go":"gaan","jump_bottom":"naar laatste bericht","jump_prompt":"springen naar...","jump_prompt_of":"van %{count} berichten","jump_prompt_long":"Springen naar...","jump_bottom_with_number":"naar bericht %{post_number}","jump_prompt_to_date":"tot datum","jump_prompt_or":"of","total":"totale aantal berichten","current":"huidige bericht"},"notifications":{"title":"wijzigen hoe vaak u meldingen over dit topic ontvangt","reasons":{"mailing_list_mode":"U hebt de mailinglijstmodus ingeschakeld, dus u ontvangt meldingen over antwoorden op dit topic via e-mail.","3_10":"U ontvangt meldingen, omdat u een tag in dit topic in de gaten houdt.","3_6":"U ontvangt meldingen, omdat u deze categorie in de gaten houdt.","3_5":"U ontvangt meldingen, omdat u dit topic automatisch in de gaten houdt.","3_2":"U ontvangt meldingen, omdat u dit topic in de gaten houdt.","3_1":"U ontvangt meldingen, omdat u dit topic hebt aangemaakt.","3":"U ontvangt meldingen, omdat u dit topic in de gaten houdt.","2_8":"U ziet het aantal nieuwe antwoorden, omdat u deze categorie volgt.","2_4":"U ziet het aantal nieuwe antwoorden, omdat u een antwoord in dit topic hebt geplaatst.","2_2":"U ziet het aantal nieuwe antwoorden, omdat u dit topic volgt.","2":"U ziet het aantal nieuwe antwoorden, omdat u \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003edit topic hebt gelezen\u003c/a\u003e.","1_2":"U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt.","1":"U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt.","0_7":"U negeert alle meldingen in deze categorie.","0_2":"U negeert alle meldingen in dit topic.","0":"U negeert alle meldingen in dit topic."},"watching_pm":{"title":"In de gaten houden","description":"U ontvangt een melding voor elk nieuw antwoord op dit bericht, en het aantal nieuwe antwoorden wordt weergegeven."},"watching":{"title":"In de gaten houden","description":"U ontvangt een melding voor elk nieuw antwoord in dit topic, en het aantal nieuwe antwoorden wordt weergegeven."},"tracking_pm":{"title":"Volgen","description":"Het aantal nieuwe antwoorden op dit bericht wordt weergegeven. U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt."},"tracking":{"title":"Volgen","description":"Het aantal nieuwe antwoorden op dit topic wordt weergegeven. U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt."},"regular":{"title":"Normaal","description":"U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt."},"regular_pm":{"title":"Normaal","description":"U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt."},"muted_pm":{"title":"Genegeerd","description":"U ontvangt geen enkele melding over dit bericht."},"muted":{"title":"Genegeerd","description":"U ontvangt geen enkele melding over dit topic, en het verschijnt niet in Nieuwste."}},"actions":{"title":"Acties","recover":"Topic verwijderen ongedaan maken","delete":"Topic verwijderen","open":"Topic openen","close":"Topic sluiten","multi_select":"Berichten selecteren...","timed_update":"Topictimer instellen...","pin":"Topic vastmaken...","unpin":"Topic losmaken...","unarchive":"Topic dearchiveren","archive":"Topic archiveren","invisible":"Onzichtbaar maken","visible":"Zichtbaar maken","reset_read":"Leesgegevens herinitialiseren","make_public":"Topic openbaar maken","make_private":"Persoonlijk bericht maken","reset_bump_date":"Bumpdatum terugzetten"},"feature":{"pin":"Topic vastmaken","unpin":"Topic losmaken","pin_globally":"Topic globaal vastmaken","make_banner":"Bannertopic maken","remove_banner":"Bannertopic verwijderen"},"reply":{"title":"Antwoorden","help":"beginnen met opstellen van een antwoord op dit topic"},"clear_pin":{"title":"Losmaken","help":"De vastgezette status van dit topic wissen, zodat het niet meer bovenaan uw topiclijst verschijnt."},"share":{"title":"Delen","extended_title":"Een koppeling delen","help":"een koppeling naar dit topic delen"},"print":{"title":"Afdrukken","help":"Een printervriendelijke versie van dit topic openen"},"flag_topic":{"title":"Markeren","help":"een privémarkering aan dit topic geven of er een privébericht over sturen","success_message":"U hebt dit topic gemarkeerd."},"make_public":{"title":"Converteren naar openbaar topic","choose_category":"Kies een categorie voor het openbare topic:"},"feature_topic":{"title":"Dit topic aanbevelen","pin":"Dit topic boven in de categorie {{categoryLink}} laten verschijnen tot","confirm_pin":"U hebt al {{count}} vastgemaakte topics. Te veel vastgemaakte topics kunnen storend zijn voor nieuwe en anonieme gebruikers. Weet u zeker dat u nog een topic in deze categorie wilt vastmaken?","unpin":"Verwijder dit topic uit de bovenkant van de categorie {{categoryLink}}.","unpin_until":"Verwijder dit topic uit de bovenkant van de categorie {{categoryLink}} of wacht tot \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Gebruikers kunnen het topic individueel voor zichzelf losmaken.","pin_validation":"Er is een datum vereist om dit topic vast te maken.","not_pinned":"Er zijn geen topics vastgemaakt in {{categoryLink}}.","already_pinned":{"one":"Momenteel vastgemaakte topics in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Momenteel vastgemaakte topics in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"pin_globally":"Dit topic bovenaan in alle topiclijsten laten verschijnen tot","confirm_pin_globally":"U hebt al {{count}} globaal vastgemaakte topics. Te veel vastgemaakte topics kunnen storend zijn voor nieuwe en anonieme gebruikers. Weet u zeker dat u nog een topic globaal wilt vastmaken?","unpin_globally":"Verwijder dit topic uit de bovenkant van alle topiclijsten.","unpin_globally_until":"Verwijder dit topic uit de bovenkant van alle topiclijsten of wacht tot \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Gebruikers kunnen het topic individueel voor zichzelf losmaken.","not_pinned_globally":"Er zijn geen globaal vastgemaakte topics.","already_pinned_globally":{"one":"Momenteel globaal vastgemaakte topics: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Momenteel globaal vastgemaakte topics: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"make_banner":"Dit topic omzetten naar een banner die bovenaan alle pagina's verschijnt","remove_banner":"De banner die bovenaan alle pagina's verschijnt verwijderen","banner_note":"Gebruikers kunnen de banner negeren door deze te sluiten. Er kan maar één bannertopic tegelijk bestaan.","no_banner_exists":"Er is geen bannertopic.","banner_exists":"Er \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e momenteel een bannertopic."},"inviting":"Uitnodigen...","automatically_add_to_groups":"Deze uitnodiging geeft ook toegang tot de volgende groepen:","invite_private":{"title":"Uitnodigen voor bericht","email_or_username":"E-mailadres of gebruikersnaam van genodigde","email_or_username_placeholder":"e-mailadres of gebruikersnaam","action":"Uitnodigen","success":"Die gebruiker is uitgenodigd om aan deze conversatie deel te nemen.","success_group":"Die groep is uitgenodigd om aan deze conversatie deel te nemen.","error":"Sorry, er is een fout opgetreden bij het uitnodigen van die gebruiker.","group_name":"groepsnaam"},"controls":"Topic-instellingen","invite_reply":{"title":"Uitnodigen","username_placeholder":"gebruikersnaam","action":"Uitnodiging sturen","help":"anderen uitnodigen voor dit topic via e-mail of meldingen","to_forum":"We sturen een kort mailtje waarmee uw vriend(in) direct kan deelnemen door op een koppeling te klikken; er is geen aanmelding vereist.","sso_enabled":"Voer de gebruikersnaam in van de persoon die u voor dit topic wilt uitnodigen.","to_topic_blank":"Voer de gebruikersnaam of het e-mailadres in van de persoon die u voor dit topic wilt uitnodigen.","to_topic_email":"U hebt een e-mailadres ingevoerd. We sturen een uitnodiging per e-mail waarmee uw vriend(in) direct op dit topic kan antwoorden.","to_topic_username":"U hebt een gebruikersnaam ingevoerd. We sturen een melding met een uitnodigingskoppeling om aan dit topic deel te nemen.","to_username":"Voer de gebruikersnaam in van de persoon die u wilt uitnodigen. We sturen een melding met een uitnodigingskoppeling om aan dit topic deel te nemen.","email_placeholder":"name@example.com","success_email":"Er is een uitnodiging naar \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e gemaild. We stellen u op de hoogte als op de uitnodiging is ingegaan. Controleer het uitnodigingentabblad op uw gebruikerspagina om uw uitnodigingen bij te houden.","success_username":"We hebben die gebruiker uitgenodigd om aan dit topic deel te nemen.","error":"Sorry, we konden deze persoon niet uitnodigen. Misschien is deze al uitgenodigd? (Uitnodigingen zijn in aantal beperkt)","success_existing_email":"Een gebruiker met de e-mail \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e bestaat al. We hebben deze gebruiker uitgenodigd om aan dit topic deel te nemen."},"login_reply":"Meld u aan om te antwoorden","filters":{"n_posts":{"one":"%{count} bericht","other":"{{count}} berichten"},"cancel":"Filter verwijderen"},"move_to":{"title":"Verplaatsen naar","action":"verplaatsen naar","error":"Er is een fout opgetreden bij het verplaatsen van berichten."},"split_topic":{"title":"Verplaatsen naar nieuw topic","action":"verplaatsen naar nieuw topic","topic_name":"Titel van nieuw topic","radio_label":"Nieuw topic","error":"Er is een fout opgetreden bij het verplaatsen van berichten naar het nieuwe topic.","instructions":{"one":"U gaat een nieuw topic aanmaken en met het geselecteerde bericht vullen.","other":"U gaat een nieuw topic aanmaken en met de \u003cb\u003e{{count}}\u003c/b\u003e geselecteerde berichten vullen."}},"merge_topic":{"title":"Verplaatsen naar bestaand topic","action":"verplaatsen naar bestaand topic","error":"Er is een fout opgetreden bij het verplaatsen van berichten naar dat topic.","radio_label":"Bestaand topic","instructions":{"one":"Selecteer het topic waarnaar u dat bericht wilt verplaatsen.","other":"Selecteer het topic waarnaar u de \u003cb\u003e{{count}}\u003c/b\u003e berichten wilt verplaatsen."}},"move_to_new_message":{"title":"Verplaatsen naar nieuw bericht","action":"verplaatsen naar nieuw bericht","message_title":"Titel van nieuw bericht","radio_label":"Nieuw bericht","participants":"Deelnemers","instructions":{"one":"U gaat een nieuw bericht maken en met het geselecteerde bericht vullen.","other":"U gaat een nieuw bericht maken en met de \u003cb\u003e{{count}}\u003c/b\u003e geselecteerde berichten vullen."}},"move_to_existing_message":{"title":"Verplaatsen naar bestaand bericht","action":"verplaatsen naar bestaand bericht","radio_label":"Bestaand bericht","participants":"Deelnemers","instructions":{"one":"Kies het bericht waarnaar u dat bericht wilt verplaatsen.","other":"Kies het bericht waarnaar u die \u003cb\u003e{{count}}\u003c/b\u003e berichten wilt verplaatsen."}},"merge_posts":{"title":"Geselecteerde berichten samenvoegen","action":"geselecteerde berichten samenvoegen","error":"Er is een fout opgetreden bij het samenvoegen van de geselecteerde berichten."},"publish_page":{"title":"Pagina's publiceren","publish":"Publiceren","description":"Wanneer een topic als een pagina wordt gepubliceerd, kan de URL ervan worden gedeeld en wordt deze met aangepaste stijlen weergegeven.","slug":"Slug","publish_url":"Uw pagina is gepubliceerd op:","topic_published":"Uw topic is gepubliceerd op:","preview_url":"Uw pagina wordt gepubliceerd op:","invalid_slug":"Sorry, u kunt deze pagina niet publiceren.","unpublish":"Publicatie ongedaan maken","unpublished":"Uw pagina is niet meer gepubliceerd en niet meer toegankelijk.","publishing_settings":"Publicatie-instellingen"},"change_owner":{"title":"Eigenaar wijzigen","action":"eigendom wijzigen","error":"Er is een fout opgetreden bij het wijzigen van het eigendom van de berichten.","placeholder":"gebruikersnaam van nieuwe eigenaar","instructions":{"one":"Kies een nieuwe eigenaar voor het bericht van \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Kies een nieuwe eigenaar voor de {{count}} berichten van \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Kies een nieuwe eigenaar voor het bericht","other":"Kies een nieuwe eigenaar voor de {{count}} berichten"}},"change_timestamp":{"title":"Tijdstempel wijzigen...","action":"tijdstempel wijzigen","invalid_timestamp":"Tijdstempel kan niet in de toekomst liggen.","error":"Er is een fout opgetreden bij het wijzigen van de tijdstempel van het topic.","instructions":"Kies een nieuwe tijdstempel voor het topic. Berichten in het topic worden bijgewerkt, zodat het onderlinge tijdsverschil gelijk blijft."},"multi_select":{"select":"selecteren","selected":"geselecteerd ({{count}})","select_post":{"label":"selecteren","title":"Bericht aan selectie toevoegen"},"selected_post":{"label":"geselecteerd","title":"Klikken om bericht uit selectie te verwijderen"},"select_replies":{"label":"selecteren +antwoorden","title":"Bericht en alle antwoorden erop aan selectie toevoegen"},"select_below":{"label":"selecteren +volgende","title":"Bericht en alle erop volgende aan selectie toevoegen"},"delete":"geselecteerde verwijderen","cancel":"selecteren annuleren","select_all":"alles selecteren","deselect_all":"alles deselecteren","description":{"one":"U hebt \u003cb\u003e%{count}\u003c/b\u003e bericht geselecteerd.","other":"U hebt \u003cb\u003e{{count}}\u003c/b\u003e berichten geselecteerd."}},"deleted_by_author":{"one":"(topic ingetrokken door schrijver, wordt over %{count} uur automatisch verwijderd, tenzij gemarkeerd)","other":"(topic ingetrokken door schrijver, wordt over %{count} uur automatisch verwijderd, tenzij gemarkeerd)"}},"post":{"quote_reply":"Citeren","edit_reason":"Reden: ","post_number":"bericht {{number}}","ignored":"Genegeerde inhoud","wiki_last_edited_on":"wiki laatst bewerkt op","last_edited_on":"bericht laatst bewerkt op","reply_as_new_topic":"Antwoorden als gekoppeld topic","reply_as_new_private_message":"Antwoorden als nieuw bericht naar dezelfde ontvangers","continue_discussion":"Voortzetting van de discussie {{postLink}}:","follow_quote":"naar het geciteerde bericht","show_full":"Volledige bericht tonen","show_hidden":"Genegeerde inhoud weergeven.","deleted_by_author":{"one":"(bericht ingetrokken door de schrijver, wordt over %{count} uur automatisch verwijderd, tenzij gemarkeerd)","other":"(bericht ingetrokken door de schrijver, wordt over %{count} uur automatisch verwijderd, tenzij gemarkeerd)"},"collapse":"samenvouwen","expand_collapse":"uitvouwen/samenvouwen","locked":"een staflid heeft dit bericht voor bewerking vergrendeld","gap":{"one":"%{count} verborgen antwoord weergeven","other":"{{count}} verborgen antwoorden weergeven"},"notice":{"new_user":"Dit is de eerste keer dat {{user}} iets heeft geplaatst – we heten hem/haar welkom in onze gemeenschap!","returning_user":"Het is al even geleden dat we {{user}} hebben gezien – zijn/haar laatste bericht dateert van {{time}}."},"unread":"Bericht is ongelezen","has_replies":{"one":"{{count}} antwoord","other":"{{count}} antwoorden"},"has_likes_title":{"one":"%{count} persoon heeft dit bericht geliket","other":"{{count}} personen hebben dit bericht geliket"},"has_likes_title_only_you":"u hebt dit bericht geliket","has_likes_title_you":{"one":"u en %{count} andere persoon hebben dit bericht geliket","other":"u en {{count}} andere personen hebben dit bericht geliket"},"errors":{"create":"Sorry, er is een fout opgetreden bij het plaatsen van uw bericht. Probeer het opnieuw.","edit":"Sorry, er is een fout opgetreden bij het bewerken van uw bericht. Probeer het opnieuw.","upload":"Sorry, er is een fout opgetreden bij het uploaden van dat bestand. Probeer het opnieuw.","file_too_large":"Sorry, dat bestand is te groot (maximale grootte is {{max_size_kb}}kb). Misschien kunt u het uploaden naar een cloudopslagdienst, en dan de koppeling plakken?","too_many_uploads":"Sorry, u kunt maar één bestand tegelijk uploaden.","too_many_dragged_and_dropped_files":"Sorry, u kunt maar {{max}} bestanden tegelijk uploaden.","upload_not_authorized":"Sorry, het bestand dat u probeert te uploaden is niet geautoriseerd (geautoriseerde extensies: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers kunnen geen afbeeldingen uploaden.","attachment_upload_not_allowed_for_new_user":"Sorry, nieuwe gebruikers kunnen geen bijlagen uploaden.","attachment_download_requires_login":"Sorry, u dient aangemeld te zijn om bijlagen te downloaden."},"abandon_edit":{"confirm":"Weet u zeker dat u uw wijzigingen wilt negeren?","no_value":"Nee, behouden","no_save_draft":"Nee, concept opslaan","yes_value":"Ja, bewerking negeren"},"abandon":{"confirm":"Weet u zeker dat u uw bericht wilt afbreken?","no_value":"Nee, behouden","no_save_draft":"Nee, concept opslaan","yes_value":"Ja, afbreken"},"via_email":"dit bericht kwam binnen via e-mail","via_auto_generated_email":"dit bericht kwam binnen via een automatisch gegenereerde e-mail","whisper":"dit bericht is alleen toegankelijk voor moderators","wiki":{"about":"dit bericht is een wiki"},"archetypes":{"save":"Opties opslaan"},"few_likes_left":"Bedankt voor uw steun! U kunt vandaag nog een paar likes uitdelen.","controls":{"reply":"beginnen met opstellen van een antwoord op dit bericht","like":"dit bericht liken","has_liked":"u hebt dit bericht geliket","read_indicator":"leden die dit bericht hebben gelezen","undo_like":"like ongedaan maken","edit":"dit bericht bewerken","edit_action":"Bewerken","edit_anonymous":"Sorry, maar u dient aangemeld te zijn om dit bericht te bewerken.","flag":"een privémarkering aan dit topic geven of er een privébericht over sturen","delete":"dit bericht verwijderen","undelete":"dit bericht herstellen","share":"een koppeling naar dit bericht delen","more":"Meer","delete_replies":{"confirm":"Wilt u ook de antwoorden op dit bericht verwijderen?","direct_replies":{"one":"Ja, en %{count} direct antwoord","other":"Ja, en {{count}} directe antwoorden"},"all_replies":{"one":"Ja, en %{count} antwoord","other":"Ja, en alle {{count}} de antwoorden"},"just_the_post":"Nee, alleen dit bericht"},"admin":"beheeracties voor bericht","wiki":"Wiki maken","unwiki":"Wiki verwijderen","convert_to_moderator":"Stafkleur toevoegen","revert_to_regular":"Stafkleur verwijderen","rebake":"HTML opnieuw opbouwen","publish_page":"Pagina's publiceren","unhide":"Tonen","change_owner":"Eigendom wijzigen ","grant_badge":"Badge toekennen","lock_post":"Bericht vergrendelen","lock_post_description":"voorkomen dat de schrijver dit bericht bewerkt","unlock_post":"Bericht ontgrendelen","unlock_post_description":"toestaan dat de schrijver dit bericht bewerkt","delete_topic_disallowed_modal":"U hebt geen toestemming om dit topic te verwijderen. Als u echt wilt dat het wordt verwijderd, plaats dan een markering voor aandacht van een moderator, en voeg de reden bij.","delete_topic_disallowed":"u hebt geen toestemming om dit topic te verwijderen","delete_topic":"topic verwijderen","add_post_notice":"Stafmelding toevoegen","remove_post_notice":"Stafmelding verwijderen","remove_timer":"timer verwijderen"},"actions":{"flag":"Markeren","defer_flags":{"one":"Markering negeren","other":"Markeringen negeren"},"undo":{"off_topic":"Markering verwijderen","spam":"Markering verwijderen","inappropriate":"Markering verwijderen","bookmark":"Bladwijzer verwijderen","like":"Like ongedaan maken"},"people":{"off_topic":"heeft dit als off-topic gemarkeerd","spam":"heeft dit als spam gemarkeerd","inappropriate":"heeft dit als ongepast gemarkeerd","notify_moderators":"heeft moderators ingelicht","notify_user":"heeft een bericht gestuurd","bookmark":"heeft dit aan bladwijzers toegevoegd","like":{"one":"heeft dit geliket","other":"hebben dit geliket"},"read":{"one":"heeft dit gelezen","other":"hebben dit gelezen"},"like_capped":{"one":"en {{count}} ander heeft dit geliket","other":"en {{count}} anderen hebben dit geliket"},"read_capped":{"one":"en {{count}} ander heeft dit gelezen","other":"en {{count}} anderen hebben dit gelezen"}},"by_you":{"off_topic":"U hebt dit als off-topic gemarkeerd","spam":"U hebt dit als spam gemarkeerd","inappropriate":"U hebt dit als ongepast gemarkeerd","notify_moderators":"U hebt dit voor moderatie gemarkeerd","notify_user":"U hebt een bericht naar deze gebruiker gestuurd","bookmark":"U hebt een bladwijzer voor dit bericht gemaakt","like":"U hebt dit geliket"}},"delete":{"confirm":{"one":"Weet u zeker dat u dat bericht wilt verwijderen?","other":"Weet u zeker dat u die {{count}} berichten wilt verwijderen?"}},"merge":{"confirm":{"one":"Weet u zeker dat u die berichten wilt samenvoegen?","other":"Weet u zeker dat u die {{count}} berichten wilt samenvoegen?"}},"revisions":{"controls":{"first":"Eerste revisie","previous":"Vorige revisie","next":"Volgende revisie","last":"Laatste revisie","hide":"Revisie verbergen","show":"Revisie tonen","revert":"Terugkeren naar deze revisie","edit_wiki":"Wiki bewerken","edit_post":"Bericht bewerken","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"De gerenderde uitvoer met toevoegingen en verwijderingen inline tonen","button":"HTML"},"side_by_side":{"title":"De verschillen in gerenderde uitvoer naast elkaar tonen","button":"HTML"},"side_by_side_markdown":{"title":"De bronverschillen naast elkaar tonen","button":"Onbewerkt"}}},"raw_email":{"displays":{"raw":{"title":"Het onbewerkte e-mailbericht tonen","button":"Onbewerkt"},"text_part":{"title":"Het tekstgedeelte van het e-mailbericht tonen","button":"Tekst"},"html_part":{"title":"Het HTML-gedeelte van het e-mailbericht tonen","button":"HTML"}}},"bookmarks":{"create":"Bladwijzer maken","edit":"Bladwijzer bewerken","created":"Gemaakt","name":"Naam","name_placeholder":"Waar is deze bladwijzer voor?","set_reminder":"Mij herinneren","actions":{"delete_bookmark":{"name":"Bladwijzer verwijderen","description":"Verwijdert de bladwijzer uit uw profiel en stopt alle herinneringen voor de bladwijzer"},"edit_bookmark":{"name":"Bladwijzer bewerken","description":"De bladwijzernaam bewerken of de herinneringsdatum en -tijd wijzigen"}}}},"category":{"can":"kan\u0026hellip; ","none":"(geen categorie)","all":"Alle categorieën","choose":"categorie\u0026hellip;","edit":"Bewerken","edit_dialog_title":"Bewerken: %{categoryName}","view":"Topics in categorie weergeven","general":"Algemeen","settings":"Instellingen","topic_template":"Topicsjabloon","tags":"Tags","tags_allowed_tags":"Deze tags tot deze categorie beperken:","tags_allowed_tag_groups":"Deze tag-groepen tot deze categorie beperken:","tags_placeholder":"(Optioneel) lijst van toegestane tags","tags_tab_description":"Hierboven opgegeven tags en tag-groepen zijn alleen beschikbaar in deze categorie en andere categorieën die ze ook opgeven. Ze zijn niet beschikbaar voor gebruik in andere categorieën.","tag_groups_placeholder":"(Optioneel) lijst van toegestane tag-groepen","manage_tag_groups_link":"Beheer hier tag-groepen.","allow_global_tags_label":"Ook andere tags toestaan","tag_group_selector_placeholder":"(Optioneel) Tag-groep","required_tag_group_description":"Nieuwe topics moeten tags hebben uit een tag-groep:","min_tags_from_required_group_label":"Aantal tags:","required_tag_group_label":"Tag-groep:","topic_featured_link_allowed":"Aanbevolen koppelingen in deze categorie toestaan","delete":"Categorie verwijderen","create":"Nieuwe categorie","create_long":"Een nieuwe categorie maken","save":"Categorie opslaan","slug":"Slug van categorie","slug_placeholder":"(Optioneel) met streepjes verbonden woorden voor URL","creation_error":"Er is een fout opgetreden bij het maken van de categorie.","save_error":"Er is een fout opgetreden bij het opslaan van de categorie.","name":"Categorienaam","description":"Omschrijving","topic":"categorietopic","logo":"Afbeelding van categorielogo","background_image":"Achtergrondafbeelding van categorie","badge_colors":"Badgekleuren","background_color":"Achtergrondkleur","foreground_color":"Voorgrondkleur","name_placeholder":"Maximaal een of twee woorden","color_placeholder":"Willekeurige webkleur","delete_confirm":"Weet u zeker dat u deze categorie wilt verwijderen?","delete_error":"Er is een fout opgetreden bij het verwijderen van de categorie.","list":"Lijst van categorieën","no_description":"Voeg een omschrijving toe voor deze categorie.","change_in_category_topic":"Omschrijving wijzigen","already_used":"Deze kleur is al in gebruik door een andere categorie","security":"Beveiliging","special_warning":"Waarschuwing: deze categorie is een vooraf geseede categorie, en de beveiligingsinstellingen kunnen niet worden bewerkt. Als u deze categorie niet wenst te gebruiken, verwijder deze dan in plaats van het doel ervan te wijzigen.","uncategorized_security_warning":"Deze categorie is bijzonder. Hij is bedoeld als wachtruimte voor topics die geen categorie hebben, en kan geen beveiligingsinstellingen bevatten.","uncategorized_general_warning":"Deze categorie is bijzonder. Hij is bedoeld als de standaardcategorie voor nieuwe topics die geen selecteerde categorie hebben. Als u dit gedrag wilt voorkomen en categorieselectie wilt afdwingen, \u003ca href=\"%{settingLink}\"\u003eschakel de instelling dan hier uit\u003c/a\u003e. Als u de naam of omschrijving wilt wijzigen, ga dan naar \u003ca href=\"%{customizeLink}\"\u003eAanpassen / Tekstinhoud\u003c/a\u003e.","pending_permission_change_alert":"U hebt %{group} niet aan deze categorie toegevoegd; klik op deze knop om de groep toe te voegen.","images":"Afbeeldingen","email_in":"Aangepast adres voor inkomende e-mail:","email_in_allow_strangers":"E-mails van anonieme gebruikers zonder account accepteren","email_in_disabled":"Het plaatsen van nieuwe topics via e-mail is uitgeschakeld in de webite-instellingen. Om het plaatsen van nieuwe topics via e-mail mogelijk te maken, ","email_in_disabled_click":"schakelt u de instelling 'e-mail in' in.","mailinglist_mirror":"Categorie weerspiegelt een mailinglijst","show_subcategory_list":"Subcategorielijsten boven topics tonen in deze categorie","num_featured_topics":"Aantal getoonde topics op de categoriepagina:","subcategory_num_featured_topics":"Aantal aanbevolen topics op pagina van bovenliggende categorie:","all_topics_wiki":"Nieuwe topics standaard wiki's maken","subcategory_list_style":"Stijl van subcategorielijst:","sort_order":"Topiclijst sorteren op:","default_view":"Standaard topiclijst:","default_top_period":"Standaard topperiode:","allow_badges_label":"Badges laten toekennen in deze categorie","edit_permissions":"Toestemmingen wijzigen","reviewable_by_group":"Naast stafleden kunnen berichten en markeringen in deze categorie ook worden beoordeeld door:","review_group_name":"groepsnaam","require_topic_approval":"Goedkeuring van moderator voor alle nieuwe topics vereisen","require_reply_approval":"Goedkeuring van moderator voor alle nieuwe antwoorden vereisen","this_year":"dit jaar","position":"Positie op de categoriepagina:","default_position":"Standaardpositie","position_disabled":"Categorieën worden op volgorde van activiteit weergegeven. Om de volgorde van categorieën in lijsten aan te passen, ","position_disabled_click":"schakelt u de instelling 'vaste categorieposities' in.","minimum_required_tags":"Minimale aantal tags vereist in een topic:","parent":"Bovenliggende categorie","num_auto_bump_daily":"Aantal open topics dat dagelijks automatisch wordt gebumpt:","navigate_to_first_post_after_read":"Naar eerste bericht nadat topics zijn gelezen","notifications":{"watching":{"title":"In de gaten houden","description":"U houdt automatisch alle topics in deze categorieën in de gaten. U ontvangt meldingen voor elk nieuw bericht in elk topic, en het aantal nieuwe antwoorden verschijnt naast het topic."},"watching_first_post":{"title":"Eerste bericht in de gaten houden","description":"U ontvangt meldingen over nieuwe topics in deze categorie, maar niet over antwoorden op de topics."},"tracking":{"title":"Volgen","description":"U volgt automatisch alle topics in deze categorieën. U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt, en het aantal nieuwe antwoorden wordt weergegeven."},"regular":{"title":"Normaal","description":"U ontvangt een melding als iemand uw @naam noemt of een bericht van u beantwoordt."},"muted":{"title":"Genegeerd","description":"U ontvangt geen enkele melding over nieuwe topics in deze categorieën, en ze verschijnen niet in Nieuwste."}},"search_priority":{"label":"Zoekprioriteit","options":{"normal":"Normaal","ignore":"Negeren","very_low":"Zeer laag","low":"Laag","high":"Hoog","very_high":"Zeer hoog"}},"sort_options":{"default":"standaard","likes":"Likes","op_likes":"Likes op oorspronkelijke bericht","views":"Weergaven","posts":"Berichten","activity":"Activiteit","posters":"Schrijvers","category":"Categorie","created":"Gemaakt","votes":"Stemmen"},"sort_ascending":"Oplopend","sort_descending":"Aflopend","subcategory_list_styles":{"rows":"Rijen","rows_with_featured_topics":"Rijen met aanbevolen topics","boxes":"Vakken","boxes_with_featured_topics":"Vakken met aanbevolen topics"},"settings_sections":{"general":"Algemeen","moderation":"Moderatie","appearance":"Vormgeving","email":"E-mailadres"}},"flagging":{"title":"Bedankt voor het beleefd houden van onze gemeenschap!","action":"Bericht markeren","take_action":"Actie ondernemen","notify_action":"Bericht","official_warning":"Officiële waarschuwing","delete_spammer":"Spammer verwijderen","yes_delete_spammer":"Ja, spammer verwijderen","ip_address_missing":"(N.v.t.)","hidden_email_address":"(verborgen)","submit_tooltip":"De privémarkering versturen","take_action_tooltip":"De markeerdrempel direct bereiken, in plaats van op meer markeringen door de gemeenschap te wachten","cant":"Sorry, u kunt dit bericht momenteel niet markeren.","notify_staff":"Beheerders een privémelding sturen","formatted_name":{"off_topic":"Het is off-topic","inappropriate":"Het is ongepast","spam":"Het is spam"},"custom_placeholder_notify_user":"Wees specifiek, opbouwend en blijf altijd beleefd.","custom_placeholder_notify_moderators":"Laat ons met name weten waar u zich zorgen om maakt, en stuur relevante koppelingen en voorbeelden mee waar mogelijk.","custom_message":{"at_least":{"one":"voer minstens %{count} teken in","other":"voer minstens {{count}} tekens in"},"more":{"one":"%{count} teken te gaan...","other":"{{count}} tekens te gaan..."},"left":{"one":"%{count} resterend","other":"{{count}} resterend"}}},"flagging_topic":{"title":"Bedankt voor het beleefd houden van onze gemeenschap!","action":"Topic markeren","notify_action":"Bericht"},"topic_map":{"title":"Topicsamenvatting","participants_title":"Frequente schrijvers","links_title":"Populaire koppelingen","links_shown":"meer koppelingen tonen...","clicks":{"one":"%{count} klik","other":"%{count} klikken"}},"post_links":{"about":"meer koppelingen voor dit bericht uitvouwen","title":{"one":"nog %{count}","other":"nog %{count}"}},"topic_statuses":{"warning":{"help":"Dit is een officiële waarschuwing."},"bookmarked":{"help":"U hebt een bladwijzer voor dit topic gemaakt"},"locked":{"help":"Dit topic is gesloten; nieuwe antwoorden zijn niet meer mogelijk"},"archived":{"help":"Dit topic is gearchiveerd; het kan niet meer worden gewijzigd"},"locked_and_archived":{"help":"Dit topic is gesloten en gearchiveerd; nieuwe antwoorden en wijzigingen zijn niet meer mogelijk"},"unpinned":{"title":"Losgemaakt","help":"Dit topic is voor u losgemaakt; het wordt in normale volgorde weergegeven"},"pinned_globally":{"title":"Globaal vastgemaakt","help":"Dit topic is globaal vastgemaakt; het wordt boven in Nieuwste en de categorie ervan weergegeven"},"pinned":{"title":"Vastgemaakt","help":"Dit topic is voor u vastgemaakt; het wordt boven in de categorie ervan weergegeven"},"unlisted":{"help":"Dit topic is niet zichtbaar; het verschijnt niet in topiclijsten en kan alleen via een rechtstreekse koppeling worden benaderd"},"personal_message":{"title":"Dit topic is een persoonlijk bericht","help":"Dit topic is een persoonlijk bericht"}},"posts":"Berichten","posts_long":"er zijn {{number}} berichten in dit topic","original_post":"Oorspronkelijke bericht","views":"Weergaven","views_lowercase":{"one":"weergave","other":"weergaven"},"replies":"Antwoorden","views_long":{"one":"dit topic is %{count} keer bekeken","other":"dit topic is {{number}} keer bekeken"},"activity":"Activiteit","likes":"Likes","likes_lowercase":{"one":"like","other":"likes"},"likes_long":"er zijn {{count}} likes in dit topic","users":"Gebruikers","users_lowercase":{"one":"gebruiker","other":"gebruikers"},"category_title":"Categorie","history":"Geschiedenis","changed_by":"door {{author}}","raw_email":{"title":"Inkomende e-mail","not_available":"Niet beschikbaar!"},"categories_list":"Categorielijst","filters":{"with_topics":"%{filter} topics","with_category":"%{filter} topics in %{category}","latest":{"title":"Nieuwste","title_with_count":{"one":"Nieuwste (%{count})","other":"Nieuwste ({{count}})"},"help":"topics met recente berichten"},"read":{"title":"Gelezen","help":"topics die u hebt gelezen, in de volgorde waarin u ze voor het laatst hebt gelezen"},"categories":{"title":"Categorieën","title_in":"Categorie - {{categoryName}}","help":"alle topics gegroepeerd op categorie"},"unread":{"title":"Ongelezen","title_with_count":{"one":"Ongelezen (%{count})","other":"Ongelezen ({{count}})"},"help":"topics die u momenteel in de gaten houdt of volgt met ongelezen berichten","lower_title_with_count":{"one":"%{count} ongelezen","other":"{{count}} ongelezen"}},"new":{"lower_title_with_count":{"one":"%{count} nieuw","other":"{{count}} nieuw"},"lower_title":"nieuw","title":"Nieuw","title_with_count":{"one":"Nieuw (%{count})","other":"Nieuw ({{count}})"},"help":"in de afgelopen paar dagen aangemaakte topics"},"posted":{"title":"Mijn berichten","help":"topics waarin u een bericht hebt geplaatst"},"bookmarks":{"title":"Bladwijzers","help":"topics waarvoor u een bladwijzer hebt"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"nieuwste topics in de categorie {{categoryName}}"},"top":{"title":"Top","help":"de meest actieve topics van het afgelopen jaar, maand, week of dag","all":{"title":"Sinds het begin"},"yearly":{"title":"Jaarlijks"},"quarterly":{"title":"Per kwartaal"},"monthly":{"title":"Maandelijks"},"weekly":{"title":"Wekelijks"},"daily":{"title":"Dagelijks"},"all_time":"Sinds het begin","this_year":"Jaar","this_quarter":"Kwartaal","this_month":"Maand","this_week":"Week","today":"Vandaag","other_periods":"eerste bekijken"},"votes":{"title":"Stemmen","help":"topics met de meeste stemmen"}},"browser_update":"Helaas is \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003euw browser te oud om met deze website te kunnen werken\u003c/a\u003e. \u003ca href=\"https://browsehappy.com\"\u003eUpgrade uw browser\u003c/a\u003e.","permission_types":{"full":"Maken / Antwoorden / Bekijken","create_post":"Antwoorden / Bekijken","readonly":"Bekijken"},"lightbox":{"download":"downloaden","previous":"Vorige (Linkerpijltoets)","next":"Volgende (Rechterpijltoets)","counter":"%curr% van %total%","close":"Sluiten (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eDe inhoud\u003c/a\u003e kon niet worden geladen.","image_load_error":"\u003ca href=\"%url%\"\u003eDe afbeelding\u003c/a\u003e kon niet worden geladen."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} of %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Sneltoetsen","jump_to":{"title":"Snel naar","home":"%{shortcut} Hoofdpagina","latest":"%{shortcut} Nieuwste","new":"%{shortcut} Nieuw","unread":"%{shortcut} Ongelezen","categories":"%{shortcut} Categorieën","top":"%{shortcut} Top","bookmarks":"%{shortcut} Bladwijzers","profile":"%{shortcut} Profiel","messages":"%{shortcut} Berichten","drafts":"%{shortcut} Concepten"},"navigation":{"title":"Navigatie","jump":"%{shortcut} Naar bericht #","back":"%{shortcut} Terug","up_down":"%{shortcut} Selectie verplaatsen \u0026uarr; \u0026darr;","open":"%{shortcut} Geselecteerde topic openen","next_prev":"%{shortcut} Volgende/vorige sectie","go_to_unread_post":"%{shortcut} Naar het eerste ongelezen bericht"},"application":{"title":"Toepassing","create":"%{shortcut} Nieuw topic maken","notifications":"%{shortcut} Meldingen openen","hamburger_menu":"%{shortcut} Hamburgermenu openen","user_profile_menu":"%{shortcut} Gebruikersmenu openen","show_incoming_updated_topics":"%{shortcut} Bijgewerkte topics tonen","search":"%{shortcut} Zoeken","help":"%{shortcut} Hulp voor sneltoetsen openen","dismiss_new_posts":"%{shortcut} Nieuwe/Berichten negeren","dismiss_topics":"%{shortcut} Topics negeren","log_out":"%{shortcut} Afmelden"},"composing":{"title":"Opstellen","return":"%{shortcut} Terug naar editor","fullscreen":"%{shortcut} Editor in volledig scherm"},"bookmarks":{"title":"Bladwijzers maken","enter":"%{shortcut} Opslaan en sluiten","later_today":"%{shortcut} Later vandaag","later_this_week":"%{shortcut} Later deze week","tomorrow":"%{shortcut} Morgen","next_week":"%{shortcut} Volgende week","next_month":"%{shortcut} Volgende maand","next_business_week":"%{shortcut} Begin volgende week","next_business_day":"%{shortcut} Volgende werkdag","custom":"%{shortcut} Aangepaste datum en tijd","none":"%{shortcut} Geen herinnering","delete":"%{shortcut} Bladwijzer verwijderen"},"actions":{"title":"Acties","bookmark_topic":"%{shortcut} Bladwijzer voor topic in-/uitschakelen","pin_unpin_topic":"%{shortcut} Topic vastmaken/losmaken","share_topic":"%{shortcut} Topic delen","share_post":"%{shortcut} Bericht delen","reply_as_new_topic":"%{shortcut} Beantwoorden als gekoppeld topic","reply_topic":"%{shortcut} Antwoorden op topic","reply_post":"%{shortcut} Antwoorden op bericht","quote_post":"%{shortcut} Bericht citeren","like":"%{shortcut} Bericht liken","flag":"%{shortcut} Bericht markeren","bookmark":"%{shortcut} Bladwijzer voor bericht maken","edit":"%{shortcut} Bericht bewerken","delete":"%{shortcut} Bericht verwijderen","mark_muted":"%{shortcut} Topic negeren","mark_regular":"%{shortcut} Normaal (standaard) topic","mark_tracking":"%{shortcut} Topic volgen","mark_watching":"%{shortcut} Topic in de gaten houden","print":"%{shortcut} Topic afdrukken","defer":"%{shortcut} Topic negeren","topic_admin_actions":"%{shortcut} Beheeracties voor topic openen"},"search_menu":{"title":"Menu Zoeken","prev_next":"%{shortcut} Selectie omhoog en omlaag verplaatsen","insert_url":"%{shortcut} Selectie in open editorvenster invoegen"}},"badges":{"earned_n_times":{"one":"Deze badge is %{count} keer verdiend","other":"Deze badge is %{count} keer verdiend"},"granted_on":"Toegekend op %{date}","others_count":"Anderen met deze badge (%{count})","title":"Badges","allow_title":"U kunt deze badge als een titel gebruiken","multiple_grant":"U kunt dit meerdere keren verdienen","badge_count":{"one":"%{count} badge","other":"%{count} badges"},"more_badges":{"one":"+nog %{count}","other":"+nog %{count}"},"granted":{"one":"%{count} toegekend","other":"%{count} toegekend"},"select_badge_for_title":"Kies een badge om als uw titel te gebruiken","none":"(geen)","successfully_granted":"%{badge} toegekend aan %{username}","badge_grouping":{"getting_started":{"name":"Aan de slag"},"community":{"name":"Gemeenschap"},"trust_level":{"name":"Vertrouwensniveau"},"other":{"name":"Anders"},"posting":{"name":"Schrijven"}}},"tagging":{"all_tags":"Alle tags","other_tags":"Andere tags","selector_all_tags":"alle tags","selector_no_tags":"geen tags","changed":"gewijzigde tags:","tags":"Tags","choose_for_topic":"optionele tags","info":"Info","default_info":"Deze tag is niet beperkt tot categorieën, en heeft geen synoniemen.","category_restricted":"Deze tag is beperkt tot categorieën waartoe u geen toegang hebt.","synonyms":"Synoniemen","synonyms_description":"Wanneer de volgende tags worden gebruikt, worden deze vervangen door \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"Deze tag behoort tot de groep '{{tag_groups}}'.","other":"Deze tag behoort tot deze groepen: {{tag_groups}}."},"category_restrictions":{"one":"Deze kan alleen worden gebruikt in deze categorie:","other":"Deze kan alleen worden gebruikt in deze categorieën:"},"edit_synonyms":"Synoniemen beheren","add_synonyms_label":"Synoniemen toevoegen:","add_synonyms":"Toevoegen","add_synonyms_explanation":{"one":"Overal waar deze tag momenteel wordt gebruikt, zal dit worden gewijzigd naar het gebruik van \u003cb\u003e%{tag_name}\u003c/b\u003e. Weet u zeker dat u deze wijziging wilt aanbrengen?","other":"Overal waar deze tags momenteel worden gebruikt, zal dit worden gewijzigd naar het gebruik van \u003cb\u003e%{tag_name}\u003c/b\u003e. Weet u zeker dat u deze wijziging wilt aanbrengen?"},"add_synonyms_failed":"De volgende tags konden niet worden toegevoegd als synoniemen: \u003cb\u003e%{tag_names}\u003c/b\u003e. Zorg dat ze geen synoniemen hebben en geen synoniem van een andere tag zijn.","remove_synonym":"Synoniem verwijderen","delete_synonym_confirm":"Weet u zeker dat u het synoniem '%{tag_name}' wilt verwijderen?","delete_tag":"Tag verwijderen","delete_confirm":{"one":"Weet u zeker dat u deze tag wilt verwijderen en loskoppelen van %{count} topic waaraan deze is toegewezen?","other":"Weet u zeker dat u deze tag wilt verwijderen en loskoppelen van {{count}} topics waaraan deze is toegewezen?"},"delete_confirm_no_topics":"Weet u zeker dat u deze tag wilt verwijderen?","delete_confirm_synonyms":{"one":"Het synoniem ervan wordt ook verwijderd.","other":"De {{count}} synoniemen ervan worden ook verwijderd."},"rename_tag":"Tag hernoemen","rename_instructions":"Kies een nieuwe naam voor de tag:","sort_by":"Sorteren op:","sort_by_count":"aantal","sort_by_name":"naam","manage_groups":"Tag-groepen beheren","manage_groups_description":"Groepen definiëren om tags te organiseren","upload":"Tags uploaden","upload_description":"Een CSV-bestand uploaden om bulksgewijs tags te maken","upload_instructions":"Eén per regel, optioneel met een tag-groep in de notatie 'tag_name,tag_group'.","upload_successful":"Tags zijn geüpload","delete_unused_confirmation":{"one":"%{count} tag wordt verwijderd: %{tags}","other":"%{count} tags worden verwijderd: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} en nog %{count}","other":"%{tags} en nog %{count}"},"delete_unused":"Ongebruikte tags verwijderen","delete_unused_description":"Alle tags verwijderen die niet aan topics of persoonlijke berichten zijn gekoppeld","cancel_delete_unused":"Annuleren","filters":{"without_category":"%{filter} %{tag} topics","with_category":"%{filter} %{tag} topics in %{category}","untagged_without_category":"%{filter} ongetagde topics","untagged_with_category":"%{filter} ongetagde topics in %{category}"},"notifications":{"watching":{"title":"In de gaten houden","description":"U houdt automatisch alle nieuwe topics met deze tag in de gaten. U ontvangt meldingen bij alle nieuwe berichten en topics, en het aantal ongelezen en nieuwe berichten verschijnt ook naast het topic."},"watching_first_post":{"title":"Eerste bericht in de gaten houden.","description":"U ontvangt meldingen over nieuwe topics in deze tag, maar niet over antwoorden op de topics."},"tracking":{"title":"Volgen","description":"U volgt automatisch alle topics met deze tag. Het aantal ongelezen en nieuwe berichten verschijnt naast het topic."},"regular":{"title":"Normaal","description":"U ontvangt een melding wanneer iemand uw @naam noemt of een bericht van u beantwoordt."},"muted":{"title":"Genegeerd","description":"U ontvangt geen enkele melding over nieuwe topics met deze tag, en ze verschijnen niet op uw tabblad Ongelezen."}},"groups":{"title":"Tag-groepen","about":"Tags aan groepen toevoegen om deze makkelijker te beheren.","new":"Nieuwe groep","tags_label":"Tags in deze groep:","tags_placeholder":"tags","parent_tag_label":"Bovenliggende tag:","parent_tag_placeholder":"Optioneel","parent_tag_description":"Tags uit deze groep kunnen niet worden gebruikt, tenzij de bovenliggende tag actief is.","one_per_topic_label":"Beperken tot 1 tag per topic uit deze groep","new_name":"Nieuwe tag-groep","name_placeholder":"Naam van tag-groep","save":"Opslaan","delete":"Verwijderen","confirm_delete":"Weet u zeker dat u deze tag-groep wilt verwijderen?","everyone_can_use":"Tags kunnen door iedereen worden gebruikt","usable_only_by_staff":"Tags zijn voor iedereen zichtbaar, maar alleen stafleden kunnen ze gebruiken","visible_only_to_staff":"Tags zijn alleen zichtbaar voor stafleden"},"topics":{"none":{"unread":"U hebt geen ongelezen topics.","new":"U hebt geen nieuwe topics.","read":"U hebt nog geen topics gelezen.","posted":"U hebt nog geen berichten in topics geplaatst.","latest":"Er zijn geen nieuwste topics.","bookmarks":"U hebt nog geen topics met bladwijzers.","top":"Er zijn geen toptopics."},"bottom":{"latest":"Er zijn geen nieuwste topics meer.","posted":"Er zijn geen geplaatste topics meer.","read":"Er zijn geen gelezen topics meer.","new":"Er zijn geen nieuwe topics meer.","unread":"Er zijn geen ongelezen topics meer.","top":"Er zijn geen toptopics meer.","bookmarks":"Er zijn geen topics met bladwijzers meer."}}},"invite":{"custom_message":"Maak uw uitnodiging iets persoonlijker door een \u003ca href\u003eeigen bericht\u003c/a\u003e te schrijven.","custom_message_placeholder":"Voer uw eigen bericht in","custom_message_template_forum":"Hee, u zou aan dit forum moeten deelnemen!","custom_message_template_topic":"Hee, dit topic lijkt me wel iets voor u!"},"forced_anonymous":"Vanwege overbelasting wordt dit tijdelijk voor iedereen weergegeven zoals niet-aangemelde gebruikers het zien.","safe_mode":{"enabled":"Veilige modus is ingeschakeld; sluit dit browservenster om de veilige modus te verlaten"},"poll":{"voters":{"one":"stemmer","other":"stemmers"},"total_votes":{"one":"totale stem","other":"totale stemmen"},"average_rating":"Gemiddelde beoordeling: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Stemmen zijn \u003cstrong\u003eopenbaar\u003c/strong\u003e."},"results":{"groups":{"title":"U dient lid van %{groups} te zijn om in deze poll te stemmen."},"vote":{"title":"Resultaten worden getoond bij \u003cstrong\u003estemmen\u003c/strong\u003e."},"closed":{"title":"Resultaten worden getoond zodra \u003cstrong\u003egesloten\u003c/strong\u003e."},"staff":{"title":"Resultaten worden alleen aan \u003cstrong\u003estafleden\u003c/strong\u003e getoond."}},"multiple":{"help":{"at_least_min_options":{"one":"Kies minstens \u003cstrong\u003e%{count}\u003c/strong\u003e optie","other":"Kies minstens \u003cstrong\u003e%{count}\u003c/strong\u003e opties"},"up_to_max_options":{"one":"Kies maximaal \u003cstrong\u003e%{count}\u003c/string\u003e optie","other":"Kies maximaal \u003cstrong\u003e%{count}\u003c/string\u003e opties"},"x_options":{"one":"Kies \u003cstrong\u003e%{count}\u003c/strong\u003e optie","other":"Kies \u003cstrong\u003e%{count}\u003c/strong\u003e opties"},"between_min_and_max_options":"Kies \u003cstrong\u003e%{min}\u003c/strong\u003e tot \u003cstrong\u003e%{max}\u003c/strong\u003e opties"}},"cast-votes":{"title":"Uw stemmen uitbrengen","label":"Nu stemmen!"},"show-results":{"title":"De pollresultaten weergeven","label":"Resultaten tonen"},"hide-results":{"title":"Terug naar uw stemmen","label":"Stem tonen"},"group-results":{"title":"Stemmen groeperen op gebruikersveld","label":"Verdeling tonen"},"ungroup-results":{"title":"Alle stemmen combineren","label":"Verdeling verbergen"},"export-results":{"title":"De pollresultaten exporteren","label":"Exporteren"},"open":{"title":"De poll openen","label":"Openen","confirm":"Weet u zeker dat u deze poll wilt openen?"},"close":{"title":"De poll sluiten","label":"Sluiten","confirm":"Weet u zeker dat u deze poll wilt sluiten?"},"automatic_close":{"closes_in":"Sluit over \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Gesloten: \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Sorry, er is een fout opgetreden bij het omschakelen van de status van deze poll.","error_while_casting_votes":"Sorry, er is een fout opgetreden bij het uitbrengen van uw stemmen.","error_while_fetching_voters":"Sorry, er is een fout opgetreden bij het weergeven van de stemmers.","error_while_exporting_results":"Sorry, er is een fout opgetreden bij het exporteren van pollresultaten.","ui_builder":{"title":"Poll aanmaken","insert":"Poll invoegen","help":{"options_count":"Voer minstens 1 optie in","invalid_values":"Minimale waarde moet kleiner zijn dan de maximale waarde.","min_step_value":"De minimale waarde voor stap is 1"},"poll_type":{"label":"Type","regular":"Eén keuze","multiple":"Meerkeuze","number":"Numerieke beoordeling"},"poll_result":{"label":"Resultaten","always":"Altijd zichtbaar","vote":"Bij stemmen","closed":"Wanneer gesloten","staff":"Alleen stafleden"},"poll_groups":{"label":"Toegestane groepen"},"poll_chart_type":{"label":"Diagramtype"},"poll_config":{"max":"Max","min":"Min","step":"Stap"},"poll_public":{"label":"Tonen wie er heeft gestemd"},"poll_options":{"label":"Voer één polloptie per regel in"},"automatic_close":{"label":"Poll automatisch sluiten"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"De handleiding voor nieuwe gebruikers starten voor alle nieuwe gebruikers","welcome_message":"Een welkomstbericht met een snelstartgids naar alle nieuwe gebruikers sturen"}},"discourse_local_dates":{"relative_dates":{"today":"Vandaag %{time}","tomorrow":"Morgen %{time}","yesterday":"Gisteren %{time}","countdown":{"passed":"datum is verstreken"}},"title":"Datum / tijd invoegen","create":{"form":{"insert":"Invoegen","advanced_mode":"Geavanceerde modus","simple_mode":"Eenvoudige modus","format_description":"Gebruikte notatie voor het weergeven van de datum aan de gebruiker. Gebruik \"\\T\\Z\" om de tijdzone van de gebruiker in woorden weer te geven (Europe/Paris)","timezones_title":"Tijdzones om weer te geven","timezones_description":"Tijdzones worden gebruikt voor het weergeven van datums in voorbeeld en terugval.","recurring_title":"Herhaling","recurring_description":"De herhaling van een gebeurtenis definiëren. U kunt de door het formulier gegenereerde herhalingsoptie ook handmatig bewerken en een van de volgende sleutels gebruiken: years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds.","recurring_none":"Geen herhaling","invalid_date":"Ongeldige datum; zorg ervoor dat de datum en tijd juist zijn","date_title":"Datum","time_title":"Tijd","format_title":"Datumnotatie","timezone":"Tijdzone","until":"Tot...","recurring":{"every_day":"Elke dag","every_week":"Elke week","every_two_weeks":"Elke twee weken","every_month":"Elke maand","every_two_months":"Elke twee maanden","every_three_months":"Elke drie maanden","every_six_months":"Elke zes maanden","every_year":"Elk jaar"}}}},"details":{"title":"Details verbergen"},"presence":{"replying":"beantwoorden","editing":"bewerken","replying_to_topic":{"one":"beantwoord","other":"beantwoorden"}},"voting":{"title":"Stemmen","reached_limit":"U hebt geen stemmen meer, verwijder een bestaande stem!","list_votes":"Uw stemmen weergeven","votes_nav_help":"topics met de meeste stemmen","voted":"U hebt op dit topic gestemd","allow_topic_voting":"Gebruikers mogen op topics in deze categorie stemmen","vote_title":"Stem","vote_title_plural":"Stemmen","voted_title":"Gestemd","voting_closed_title":"Gesloten","voting_limit":"Limiet","votes_left":{"one":"U hebt {{count}} stem over, bekijk \u003ca href='{{path}}'\u003euw stemmen\u003c/a\u003e.","other":"U hebt {{count}} stemmen over, bekijk \u003ca href='{{path}}'\u003euw stemmen\u003c/a\u003e."},"votes":{"one":"{{count}} stem","other":"{{count}} stemmen"},"anonymous_button":{"one":"Stem","other":"Stemmen"},"remove_vote":"Stem verwijderen"},"docker":{"upgrade":"Je Discourse-installatie is verouderd.","perform_upgrade":"Klik hier om te upgraden."}}},"zh_CN":{"js":{"adplugin":{"advertisement_label":"广告"}}},"en":{"js":{"local_time":"Local Time","discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'nl';
I18n.pluralizationRules.nl = MessageFormat.locale.nl;
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


    var monthsShortWithDots = 'jan._feb._mrt._apr._mei_jun._jul._aug._sep._okt._nov._dec.'.split('_'),
        monthsShortWithoutDots = 'jan_feb_mrt_apr_mei_jun_jul_aug_sep_okt_nov_dec'.split('_');

    var monthsParse = [/^jan/i, /^feb/i, /^maart|mrt.?$/i, /^apr/i, /^mei$/i, /^jun[i.]?$/i, /^jul[i.]?$/i, /^aug/i, /^sep/i, /^okt/i, /^nov/i, /^dec/i];
    var monthsRegex = /^(januari|februari|maart|april|mei|ju[nl]i|augustus|september|oktober|november|december|jan\.?|feb\.?|mrt\.?|apr\.?|ju[nl]\.?|aug\.?|sep\.?|okt\.?|nov\.?|dec\.?)/i;

    var nl = moment.defineLocale('nl', {
        months : 'januari_februari_maart_april_mei_juni_juli_augustus_september_oktober_november_december'.split('_'),
        monthsShort : function (m, format) {
            if (!m) {
                return monthsShortWithDots;
            } else if (/-MMM-/.test(format)) {
                return monthsShortWithoutDots[m.month()];
            } else {
                return monthsShortWithDots[m.month()];
            }
        },

        monthsRegex: monthsRegex,
        monthsShortRegex: monthsRegex,
        monthsStrictRegex: /^(januari|februari|maart|april|mei|ju[nl]i|augustus|september|oktober|november|december)/i,
        monthsShortStrictRegex: /^(jan\.?|feb\.?|mrt\.?|apr\.?|mei|ju[nl]\.?|aug\.?|sep\.?|okt\.?|nov\.?|dec\.?)/i,

        monthsParse : monthsParse,
        longMonthsParse : monthsParse,
        shortMonthsParse : monthsParse,

        weekdays : 'zondag_maandag_dinsdag_woensdag_donderdag_vrijdag_zaterdag'.split('_'),
        weekdaysShort : 'zo._ma._di._wo._do._vr._za.'.split('_'),
        weekdaysMin : 'zo_ma_di_wo_do_vr_za'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD-MM-YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[vandaag om] LT',
            nextDay: '[morgen om] LT',
            nextWeek: 'dddd [om] LT',
            lastDay: '[gisteren om] LT',
            lastWeek: '[afgelopen] dddd [om] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : 'over %s',
            past : '%s geleden',
            s : 'een paar seconden',
            ss : '%d seconden',
            m : 'één minuut',
            mm : '%d minuten',
            h : 'één uur',
            hh : '%d uur',
            d : 'één dag',
            dd : '%d dagen',
            M : 'één maand',
            MM : '%d maanden',
            y : 'één jaar',
            yy : '%d jaar'
        },
        dayOfMonthOrdinalParse: /\d{1,2}(ste|de)/,
        ordinal : function (number) {
            return number + ((number === 1 || number === 8 || number >= 20) ? 'ste' : 'de');
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return nl;

})));

// moment-timezone-localization for lang code: nl

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Algiers","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Caïro","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Djibouti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Khartoem","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadishu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndjamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Sao Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Río Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucumán","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahía de Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belém","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancun","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Cayman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiabá","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaica","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Beneden Prinsen Kwartier","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceió","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinique","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlán","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Mérida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Mexico-Stad","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Noord-Dakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Noord-Dakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Noord-Dakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Puerto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarem","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint-Barthélemy","id":"America/St_Barthelemy"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Alma-Ata","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aqtau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aqtöbe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Asjchabad","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atıraw","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrein","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Bakoe","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beiroet","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bisjkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Calcutta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Chita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Tsjojbalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damascus","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dhaka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Doesjanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hongkong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkoetsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Jakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jeruzalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamtsjatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Kathmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Khandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Koeweit","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macau","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manilla","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Muscat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicosia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom-Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pyongyang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Qatar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Qyzylorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangoon","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riyad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Chi Minhstad","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sachalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seoul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Sjanghai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapore","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Tasjkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teheran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulaanbaatar","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakoetsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekaterinenburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Jerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azoren","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Canarische Eilanden","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Kaapverdië","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Faeröer","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Zuid-Georgia","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Sint-Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Gecoördineerde wereldtijd","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrakhan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Athene","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrado","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlijn","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Brussel","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Boekarest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Boedapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chisinau","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kopenhagen","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Ierse standaardtijdDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Isle of Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanboel","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lissabon","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Britse zomertijdLonden","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxemburg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskou","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Parijs","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praag","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Rome","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stockholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ulyanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Oezjhorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vaticaanstad","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Wenen","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Wolgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Warschau","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporizja","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zürich","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagosarchipel","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Christmaseiland","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocoseilanden","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comoro","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahé","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldiven","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Réunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Paaseiland","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fiji","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Îles Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"HSTHSTHDTHonolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marquesaseilanden","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Nouméa","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
