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
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += " – ";
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
})() + " erreur/heure";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/heure";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " arrive à la limite paramétrée de ";
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
})() + " erreur/heure";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/heure";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += " – ";
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
})() + " erreur/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " arrive à la limite paramétrée de ";
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
})() + " erreur/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += " – ";
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
})() + " erreur/heure";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/heure";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " a dépassé la limite paramétrée de ";
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
})() + " erreur/heure";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/heure";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += " – ";
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
})() + " erreur/heure";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/heure";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " a dépassé la limite paramétrée de ";
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
})() + " erreur/heure";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " erreurs/heure";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "Il y ";
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
r += "a <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 sujet non lu</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "a <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " sujets non lus</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "et ";
return r;
},
"false" : function(d){
var r = "";
r += "a ";
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
r += "/new'>1 nouveau sujet</a> ";
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
r += "et ";
return r;
},
"false" : function(d){
var r = "";
r += "a ";
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
})() + " nouveaux sujets</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " restant, ou ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "consulter les autres sujets dans ";
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
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Vous êtes sur le point de supprimer ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> message";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> messages";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " et ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> sujet";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> sujets";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " de cet utilisateur, supprimer son compte, bloquer les inscriptions depuis son adresse IP <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> et ajouter son adresse courriel <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> à une liste de blocage permanent. Êtes-vous sûr que cet utilisateur est réellement un spammeur ?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "\nCe sujet a ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 réponse";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " réponses";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "avec un haut ratio J'aime/messages";
return r;
},
"med" : function(d){
var r = "";
r += "avec un très haut ratio J'aime/messages";
return r;
},
"high" : function(d){
var r = "";
r += "avec un énorme ratio J'aime/messages";
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
r += "Vous êtes sur le point de supprimer ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 message";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " messages";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " et ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 sujet";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " sujets";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Êtes-vous sûr ?";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
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
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
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
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
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
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
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
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
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
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fr"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.fr = function (n) {
  if (n >= 0 && n < 2) {
    return 'one';
  }
  return 'other';
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

I18n.translations = {"fr":{"js":{"number":{"format":{"separator":",","delimiter":" "},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Octet","other":"Octets"},"gb":"Go","kb":"Ko","mb":"Mo","tb":"To"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","time_short_day":"ddd [à] HH:mm","timeline_date":"MMM YYYY","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"DD MMM YYYY H:mm","long_with_year_no_time":"DD MMM YYYY","full_with_year_no_time":"Do MMMM, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"il y a %{date}","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}h","other":"%{count}h"},"x_days":{"one":"%{count}j","other":"%{count}j"},"x_months":{"one":"%{count} mois","other":"%{count} mois"},"about_x_years":{"one":"%{count}an","other":"%{count}ans"},"over_x_years":{"one":"\u003e %{count}an","other":"\u003e %{count}ans"},"almost_x_years":{"one":"%{count}an","other":"%{count}ans"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} min","other":"%{count} mins"},"x_hours":{"one":"%{count} heure","other":"%{count} heures"},"x_days":{"one":"%{count} jour","other":"%{count} jours"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"one":"il y a %{count} min","other":"il y a %{count} mins"},"x_hours":{"one":"il y a %{count} heure","other":"il y a %{count} heures"},"x_days":{"one":"il y a %{count} jour","other":"il y a %{count} jours"},"x_months":{"one":"il y a %{count} mois","other":"il y a %{count} mois"},"x_years":{"one":"il y a %{count} an","other":"il y a %{count} ans"}},"later":{"x_days":{"one":"%{count} jour plus tard","other":"%{count} jours plus tard"},"x_months":{"one":"%{count} mois plus tard","other":"%{count} mois plus tard"},"x_years":{"one":"%{count} année plus tard","other":"%{count} années plus tard"}},"previous_month":"Mois précédent","next_month":"Mois suivant","placeholder":"date"},"share":{"topic_html":"Sujet : \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"message #%{postNumber}","close":"fermer","twitter":"Partager ce lien sur Twitter","facebook":"Partager ce lien sur Facebook","email":"Envoyer ce lien par courriel"},"action_codes":{"public_topic":"a rendu ce sujet public %{when}","private_topic":"a rendu ce sujet message direct %{when}","split_topic":"a scindé ce sujet %{when}","invited_user":"a invité %{who} %{when}","invited_group":"a invité %{who} %{when}","user_left":"%{who}a quitté cette conversation %{when}","removed_user":"a retiré %{who} %{when}","removed_group":"a retiré %{who} %{when}","autobumped":"remonté automatiquement dans la liste %{when}","autoclosed":{"enabled":"fermé automatiquement %{when}","disabled":"ouvert automatiquement %{when}"},"closed":{"enabled":"a fermé ce sujet %{when}","disabled":"a ouvert ce sujet %{when}"},"archived":{"enabled":"a archivé ce sujet %{when}","disabled":"a désarchivé ce sujet %{when}"},"pinned":{"enabled":"a épinglé ce sujet %{when}","disabled":"a désépinglé ce sujet %{when}"},"pinned_globally":{"enabled":"a épinglé ce sujet globalement %{when}","disabled":"a désépinglé ce sujet %{when}"},"visible":{"enabled":"a rendu ce sujet visible %{when}","disabled":"a rendu ce sujet invisible %{when}"},"banner":{"enabled":"a mis à la une %{when}. Il sera affiché en haut de chaque page jusqu’à ce qu'il soit ignoré par un utilisateur.","disabled":"a supprimé de la une %{when}. Il ne sera plus affiché en haut de chaque page."},"forwarded":"a transmis le courriel ci-dessus"},"topic_admin_menu":"actions du sujet","wizard_required":"Bienvenue sur votre nouveau Discourse ! Démarrons par \u003ca href='%{url}' data-auto-route='true'\u003el'assistant de configuration\u003c/a\u003e ✨","emails_are_disabled":"Le courriel sortant a été désactivé par un administrateur. Aucune notification courriel ne sera envoyée.","bootstrap_mode_enabled":"Pour rendre le lancement de votre site plus facile, vous êtes en mode 'bootstrap'. Tout nouvel utilisateur sera accordé le niveau de confiance 1 et aura les résumés par courriel hebdomadaires activés. Ceci cessera d'être le cas lorsque %{min_users} utilisateurs auront rejoints le site.","bootstrap_mode_disabled":"Le mode Bootstrap sera désactivé dans les prochaines 24 heures.","themes":{"default_description":"Par défaut","broken_theme_alert":"Votre site pourrait ne pas fonctionner parce que thème/composant %{theme} a des erreurs. Le désactiver ici : %{path}."},"s3":{"regions":{"ap_northeast_1":"Asie-Pacifique (Tokyo)","ap_northeast_2":"Asie-Pacifique (Séoul)","ap_south_1":"Asie-Pacifique (Bombay)","ap_southeast_1":"Asie-Pacifique (Singapour)","ap_southeast_2":"Asie-Pacifique (Sydney)","ca_central_1":"Canada (Centre)","cn_north_1":"Chine (Pékin)","cn_northwest_1":"Chine (Ningxia)","eu_central_1":"UE (Francfort)","eu_north_1":"EU (Stockholm)","eu_west_1":"UE (Irlande)","eu_west_2":"UE (Londres)","eu_west_3":"UE (Paris)","sa_east_1":"Amérique du Sud (São Paulo)","us_east_1":"États-Unis est (Virginie)","us_east_2":"États-Unis est (Ohio)","us_gov_east_1":"AWS GovCloud (US-Est)","us_gov_west_1":"AWS GovCloud (US-Ouest)","us_west_1":"États-Unis ouest (Californie)","us_west_2":"États-Unis ouest (Oregon)"}},"edit":"modifier le titre et la catégorie de ce sujet","expand":"Développer","not_implemented":"Cette fonctionnalité n'a pas encore été implémentée, désolé !","no_value":"Non","yes_value":"Oui","submit":"Envoyer","generic_error":"Désolé, une erreur est survenue.","generic_error_with_reason":"Une erreur est survenue : %{error}","go_ahead":"Procéder","sign_up":"S'inscrire","log_in":"Se connecter","age":"Âge","joined":"Inscrit","admin_title":"Administration","show_more":"afficher plus","show_help":"options","links":"Liens","links_lowercase":{"one":"lien","other":"liens"},"faq":"FAQ","guidelines":"Charte","privacy_policy":"Politique de confidentialité","privacy":"Confidentialité","tos":"Conditions générales d'utilisation","rules":"Règles","conduct":"Charte","mobile_view":"Vue mobile","desktop_view":"Vue bureau","you":"Vous","or":"ou","now":"à l'instant","read_more":"lire la suite","more":"Plus","less":"Moins","never":"jamais","every_30_minutes":"toutes les 30 minutes","every_hour":"chaque heure","daily":"quotidiennes","weekly":"hebdomadaires","every_month":"chaque mois","every_six_months":"tous les six mois","max_of_count":"maximum sur {{count}}","alternation":"ou","character_count":{"one":"{{count}} caractère","other":"{{count}} caractères"},"related_messages":{"title":"Messages Connexes","see_all":"Voir \u003ca href=\"%{path}\"\u003etous les messages\u003c/a\u003e de @%{username}..."},"suggested_topics":{"title":"À lire ensuite","pm_title":"À lire ensuite"},"about":{"simple_title":"À propos","title":"À propos du site %{title}","stats":"Statistiques du site","our_admins":"Nos administrateurs","our_moderators":"Nos modérateurs","moderators":"Modérateurs","stat":{"all_time":"Depuis toujours","last_7_days":"Derniers 7","last_30_days":"Derniers 30"},"like_count":"J'aime","topic_count":"Sujets","post_count":"Nombre de messages","user_count":"Utilisateurs","active_user_count":"Utilisateurs actifs","contact":"Nous contacter","contact_info":"En cas de problème critique ou urgent sur ce site, veuillez nous contacter : %{contact_info}"},"bookmarked":{"title":"Mettre un signet","clear_bookmarks":"Retirer les signets","help":{"bookmark":"Cliquer pour mettre un signet sur le premier message de ce sujet","unbookmark":"Cliquer pour retirer tous les signets de ce sujet"}},"bookmarks":{"created":"vous avez mis un signet à ce message","not_bookmarked":"mettre un signet à ce message","remove":"Retirer le signet","confirm_clear":"Êtes-vous sûr de vouloir retirer tous les signets de ce sujet ?","save":"Sauvegarder","no_timezone":"Vous n\u0026#39;avez pas encore défini de fuseau horaire. Vous ne pourrez pas définir de rappels. Configurez-en un \u003ca href=\"%{basePath}/my/preferences/profile\"\u003edans votre profil\u003c/a\u003e.","reminders":{"at_desktop":"La prochaine fois je suis à mon bureau","later_today":"Plus tard aujourd'hui","tomorrow":"Demain","next_week":"Semaine prochaine","later_this_week":"Plus tard cette semaine","start_of_next_business_week":"Lundi prochain","next_month":"Mois prochai","custom":"Date et heure personnalisés"}},"drafts":{"resume":"Reprendre","remove":"Supprimer","new_topic":"Nouveau brouillon de sujet","new_private_message":"Nouveau brouillon de message direct","topic_reply":"Créer un brouillon de réponse","abandon":{"confirm":"Vous avez déjà ouvert un autre brouillon dans ce sujet. Êtes-vous sûr de vouloir l'abandonner ?","yes_value":"Oui, abandonner","no_value":"Non, garder"}},"topic_count_latest":{"one":"Voir {{count}} sujet récent ou mis à jour.","other":"Voir {{count}} sujets récents ou mis à jour"},"topic_count_unread":{"one":"Voir {{count}} sujet non lu","other":"Voir {{count}} sujets non lus"},"topic_count_new":{"one":"Voir {{count}} nouveau sujet","other":"Voir {{count}} nouveaux sujets"},"preview":"prévisualiser","cancel":"annuler","save":"Sauvegarder","saving":"Sauvegarde en cours…","saved":"Sauvegardé !","upload":"Joindre un fichier","uploading":"Envoi en cours…","uploading_filename":"En cours de transfert : {{filename}}...","clipboard":"presse-papiers","uploaded":"Envoyé !","pasting":"Coller...","enable":"Activer","disable":"Désactiver","continue":"Poursuivre","undo":"Annuler","revert":"Rétablir","failed":"Échec","switch_to_anon":"Activer le mode anonyme","switch_from_anon":"Quitter le mode anonyme","banner":{"close":"Ignorer cette bannière.","edit":"Modifier cette bannière \u003e\u003e"},"pwa":{"install_banner":"Voulez-vous \u003ca href\u003einstaller %{title} sur cet appareil?\u003c/a\u003e"},"choose_topic":{"none_found":"Aucun sujet trouvé.","title":{"search":"Chercher un Sujet","placeholder":"Saisir ici le titre du sujet, son URL ou son id"}},"choose_message":{"none_found":"Aucun message trouvé.","title":{"search":"Chercher un Message","placeholder":"saisir ici l'intitulé du sujet, son URL ou son id"}},"review":{"order_by":"Trier par","in_reply_to":"en réponse à","explain":{"why":"expliquer pourquoi cet élément s'est retrouvé dans la file d'attente","title":"Notation révisable","formula":"Formule","subtotal":"Sous-total","total":"Total","min_score_visibility":"Score minimum pour la visibilité","score_to_hide":"Score pour cacher le message","take_action_bonus":{"name":"intervenu","title":"Lorsqu'un membre du personnel choisit d'agir, l'indicateur reçoit un bonus."},"user_accuracy_bonus":{"name":"précision de l’utilisateur","title":"Utilisateurs dont les signalements ont généralement été approuvés obtiennent un bonus."},"trust_level_bonus":{"name":"niveau de confiance","title":"Les éléments révisables créés par les utilisateurs ayant un niveau de confiance plus élevé ont un score plus élevé."},"type_bonus":{"name":"indiquer le bonus","title":"Certains types révisables peuvent se voir attribuer un bonus par les Responsables pour en élever la priorité."}},"claim_help":{"optional":"Vous pouvez réserver cet élément pour empêcher d'autres de le vérifier.","required":"Vous devez réserver des éléments avant des les vérifier.","claimed_by_you":"Vous avez réservé cet élément et pouvez le vérifier.","claimed_by_other":"Cet élément ne peut être vérifier que par \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"réserver ce sujet"},"unclaim":{"help":"retirer cette réservation"},"awaiting_approval":"En attente d'approbation","delete":"Supprimer","settings":{"saved":"Sauvegardé","save_changes":"Sauvegarder","title":"Paramètres","priorities":{"title":"Priorités vérifications"}},"moderation_history":"Historique de modération","view_all":"Tout voir","grouped_by_topic":"Groupé par sujet","none":"Il n'y a pas d'éléments à vérifier.","view_pending":"voir les messages en attente","topic_has_pending":{"one":"Ce sujet a \u003cb\u003e%{count}\u003c/b\u003e message en attente de validation","other":"Ce sujet a \u003cb\u003e{{count}}\u003c/b\u003e messages en attente de validation"},"title":"Vérification","topic":"Sujet :","filtered_topic":"Vous avez restreint au contenu vérifiable dans un seul sujet.","filtered_user":"Utilisateur","show_all_topics":"afficher tous les sujets","deleted_post":"(message supprimé)","deleted_user":"(utilisateur supprimé)","user":{"bio":"Biographie","website":"Site web","username":"Pseudo","email":"Courriel","name":"Nom","fields":"Champs"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} signalement total)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} signalements total)"},"agreed":{"one":"{{count}}% accepté","other":"{{count}}% acceptés"},"disagreed":{"one":"{{count}}% rejeté","other":"{{count}}% rejetés"},"ignored":{"one":"{{count}}% ignoré","other":"{{count}}% ignorés"}},"topics":{"topic":"Sujet","reviewable_count":"Nombre","reported_by":"Signalé par","deleted":"[Sujet supprimé]","original":"(sujet d'origine)","details":"détails","unique_users":{"one":"%{count} utilisateur","other":"{{count}} utilisateurs"}},"replies":{"one":"%{count} réponse","other":"{{count}} réponses"},"edit":"Modifier","save":"Sauvegarder","cancel":"Annuler","new_topic":"Approuver cet élément créera un nouveau sujet.","filters":{"all_categories":"(toutes les catégories)","type":{"title":"Type","all":"(tous les types)"},"minimum_score":"Score minimum :","refresh":"Rafraîchir","status":"Etat","category":"Catégorie","orders":{"priority":"Priorité","priority_asc":"Priorité (inverse)","created_at":"Créé à","created_at_asc":"Créé à (inverse)"},"priority":{"title":"Priorité minimum","low":"(tous)","medium":"Moyenne","high":"Fort"}},"conversation":{"view_full":"voir conversation entière"},"scores":{"about":"Ce score est calculé en fonction du niveau de confiance de l'utilisateur qui a signalé, de l'exactitude de ses indicateurs précédents et de la priorité de l'élément déclaré.","score":"Score","date":"Date","type":"Type","status":"Etat","submitted_by":"Soumis par","reviewed_by":"Vérifié par"},"statuses":{"pending":{"title":"En attente"},"approved":{"title":"Acceptés :"},"rejected":{"title":"Rejetés"},"ignored":{"title":"Ignorés"},"deleted":{"title":"Supprimés"},"reviewed":{"title":"(vérifiés)"},"all":{"title":"(tout)"}},"types":{"reviewable_flagged_post":{"title":"Message signalé","flagged_by":"Signalé par"},"reviewable_queued_topic":{"title":"Sujet en file d'attente"},"reviewable_queued_post":{"title":"Message en file d'attente"},"reviewable_user":{"title":"Utilisateur"}},"approval":{"title":"Ce message doit être approuvé","description":"Votre nouveau message a bien été envoyé, mais il doit être accepté par un modérateur avant d'apparaître publiquement. Merci de votre patience.","pending_posts":{"one":"Vous avez \u003cstrong\u003e%{count}\u003c/strong\u003e message en attente.","other":"Vous avez \u003cstrong\u003e{{count}}\u003c/strong\u003e messages en attente."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a démarré \u003ca href='{{topicUrl}}'\u003ele sujet\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eVous\u003c/a\u003e avez démarré \u003ca href='{{topicUrl}}'\u003ele sujet\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a répondu à \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eVous\u003c/a\u003e avez répondu à \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e a répondu à \u003ca href='{{topicUrl}}'\u003ece sujet\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eVous\u003c/a\u003e avez répondu à \u003ca href='{{topicUrl}}'\u003ece sujet\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e a mentionné \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user2Url}}'\u003eVous\u003c/a\u003e avez été mentionné par \u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eVous\u003c/a\u003e avez mentionné \u003ca href='{{user2Url}}'\u003e{{user}}\u003c/a\u003e","posted_by_user":"Rédigé par \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Rédigé par \u003ca href='{{userUrl}}'\u003evous\u003c/a\u003e","sent_by_user":"Envoyé par \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Envoyé par \u003ca href='{{userUrl}}'\u003evous\u003c/a\u003e"},"directory":{"filter_name":"filtrer par pseudo","title":"Utilisateurs","likes_given":"Donnés","likes_received":"Reçus","topics_entered":"Vus","topics_entered_long":"Sujets consultés","time_read":"Temps de lecture","topic_count":"Sujets","topic_count_long":"Sujets créés","post_count":"Réponses","post_count_long":"Réponses envoyées","no_results":"Aucun résultat n'a été trouvé.","days_visited":"Visites","days_visited_long":"Jours visités","posts_read":"Lus","posts_read_long":"Messages lus","total_rows":{"one":"%{count} utilisateur","other":"%{count} utilisateurs"}},"group_histories":{"actions":{"change_group_setting":"Changer les paramètres du groupe","add_user_to_group":"Ajouter l'utilisateur","remove_user_from_group":"Supprimer l'utilisateur","make_user_group_owner":"Rendre propriétaire","remove_user_as_group_owner":"Retirer le propriétaire"}},"groups":{"member_added":"Ajouté","member_requested":"Requis à","add_members":{"title":"Ajouter membres","description":"Gérer les membres de ce groupe","usernames":"Pseudos"},"requests":{"title":"Requêtes","reason":"Raison","accept":"Accepter","accepted":"accepté","deny":"Refuser","denied":"refusé","undone":"requête annulée","handle":"Gérer demande d'adhésion"},"manage":{"title":"Gérer","name":"Nom","full_name":"Nom complet","add_members":"Ajouter des membres","delete_member_confirm":"Supprimer %{username} du groupe « %{group} » ?","profile":{"title":"Profil"},"interaction":{"title":"Intéraction","posting":"Contribution","notification":"Notification"},"membership":{"title":"Adhésion","access":"Accès"},"logs":{"title":"Journaux","when":"Quand","action":"Action","acting_user":"Utilisateur agissant","target_user":"Utilisateur cible","subject":"Sujet","details":"Détails","from":"From","to":"À"}},"public_admission":"Autoriser les utilisateurs à rejoindre le groupe librement (nécessite que le groupe soit visible)","public_exit":"Autoriser les utilisateurs à quitter librement le groupe","empty":{"posts":"Il n'y a aucun message de membres de ce groupe.","members":"Il n' y a aucun membre dans ce groupe.","requests":"Il n'y a aucune demande pour rejoindre ce groupe","mentions":"Il n'y a aucune mention de ce groupe.","messages":"Il n'y a aucun message pour ce groupe.","topics":"Il n'y a aucun sujet par des membres de ce groupe.","logs":"Il n'y a aucun journal pour ce groupe."},"add":"Ajouter","join":"Rejoindre","leave":"Quitter","request":"Requête","message":"Message","confirm_leave":"Êtes-vous sûr(e) de vouloir quitter ce groupe ?","allow_membership_requests":"Autoriser les utilisateurs à envoyer des demandes d'adhésion aux propriétaires de groupe (nécessite que le groupe soit visible publiquement)","membership_request_template":"Modèle personnalisé à afficher aux utilisateurs lors de l'envoi d'une demande d'adhésion","membership_request":{"submit":"Soumettre la demande","title":"Demander à rejoindre @%{group_name}","reason":"Expliquez au propriétaire du groupe pourquoi vous avez votre place dans ce groupe"},"membership":"Adhésion","name":"Nom","group_name":"Nom du groupe","user_count":"Utilisateurs","bio":"À propos du groupe","selector_placeholder":"saisir pseudo","owner":"propriétaire","index":{"title":"Groupes","all":"Tous les groupes","empty":"Il n'y a aucun groupe visible.","filter":"Filtrer par type de groupe","owner_groups":"Mes groupes","close_groups":"Groupes fermés","automatic_groups":"Groupes automatiques","automatic":"Automatique","closed":"Fermé","public":"Public","private":"Privé","public_groups":"Groupes publics","automatic_group":"Groupe automatique","close_group":"Fermer groupe","my_groups":"Mes groupes","group_type":"Type de groupe","is_group_user":"Membre","is_group_owner":"Propriétaire"},"title":{"one":"Groupe","other":"Groupes"},"activity":"Activité","members":{"title":"Membres","filter_placeholder_admin":"pseudo ou courriel","filter_placeholder":"pseudo","remove_member":"Enlever membre","remove_member_description":"Enlever \u003cb\u003e%{username}\u003c/b\u003e de ce groupe","make_owner":"Rendre propriétaire","make_owner_description":"Rendre\u003cb\u003e%{username}\u003c/b\u003e propriétaire de ce groupe","remove_owner":"Enlever comme propriétaire","remove_owner_description":"Enlever \u003cb\u003e%{username}\u003c/b\u003e comme propriétaire de ce groupe","owner":"Propriétaire","forbidden":"Vous n'êtes pas autorisé à voir les membres."},"topics":"Sujets","posts":"Messages","mentions":"Mentions","messages":"Messages","notification_level":"Niveau de notification par défaut pour les messages de groupe","alias_levels":{"mentionable":"Qui peut @mentionner ce groupe ?","messageable":"Qui peut envoyer un message à ce groupe ?","nobody":"Personne","only_admins":"Seulement les administrateurs ","mods_and_admins":"Seulement les modérateurs et les administrateurs ","members_mods_and_admins":"Seulement les membres du groupe, les modérateurs et les administrateurs ","owners_mods_and_admins":"Seuls les propriétaires, modérateurs et administrateurs du groupe","everyone":"Tout le monde"},"notifications":{"watching":{"title":"Surveiller","description":"Vous serez notifié de chaque nouvelle réponse dans chaque message, et le nombre de nouvelles réponses sera affiché."},"watching_first_post":{"title":"Surveiller les nouveaux sujets","description":"Vous serez averti de nouveaux messages dans ce groupe mais pas de réponses aux messages."},"tracking":{"title":"Suivre","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond, et le nombre de nouvelles réponses sera affiché."},"regular":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"muted":{"title":"Silencieux","description":"Nous ne serez jamais notifié de quoi que ce soit à propos des messages dans ce groupe."}},"flair_url":"Image de la vignette d'avatar","flair_url_placeholder":"(Facultatif) URL de l'image ou classe Font Awesome","flair_url_description":"Utiliser des images de minimum 20px fois 20px ou des icônes FontAwesome (formats acceptés : \"fa-icon\", \"far fa-icon\" ou \"fab fa-icon\").","flair_bg_color":"Couleur de l'arrière-plan de la vignette d'avatar","flair_bg_color_placeholder":"(Facultatif) Couleur en héxadécimal","flair_color":"Couleur de la vignette d'avatar","flair_color_placeholder":"(Facultatif) Couleur en héxadécimal","flair_preview_icon":"Prévisualiser l'icône","flair_preview_image":"Prévisualiser l'image"},"user_action_groups":{"1":"J'aime donnés","2":"J'aime reçus","3":"Signets","4":"Sujets","5":"Réponses","6":"Réponses","7":"Mentions","9":"Citations","11":"Modifications","12":"Éléments envoyés","13":"Boîte de réception","14":"En attente","15":"Brouillons"},"categories":{"all":"toutes les catégories","all_subcategories":"toutes","no_subcategory":"aucune","category":"Catégorie","category_list":"Afficher la liste des catégories","reorder":{"title":"Réordonner les catégories","title_long":"Réorganiser la liste des catégories","save":"Enregistrer l'ordre","apply_all":"Appliquer","position":"Position"},"posts":"Messages","topics":"Sujets","latest":"Récents","latest_by":"dernier sujet de","toggle_ordering":"modifier le mode du tri","subcategories":"Sous-catégories","topic_sentence":{"one":"%{count} sujet","other":"%{count} sujets"},"topic_stat_sentence_week":{"one":"%{count}nouveau sujet dans la dernière semaine.","other":"%{count} nouveaux sujets dans la dernière semaine."},"topic_stat_sentence_month":{"one":"%{count} nouveau sujet dans le dernier mois.","other":"%{count} nouveaux sujets dans le dernier mois."},"n_more":"Catégories (%{count} autres) ..."},"ip_lookup":{"title":"Rechercher l'adresse IP","hostname":"Nom de l'hôte","location":"Localisation","location_not_found":"(inconnu)","organisation":"Société","phone":"Téléphone","other_accounts":"Autres comptes avec cette adresse IP :","delete_other_accounts":"Supprimer %{count}","username":"pseudo","trust_level":"NC","read_time":"temps de lecture","topics_entered":"sujets visités","post_count":"# messages","confirm_delete_other_accounts":"Êtes-vous sûr de vouloir supprimer tous ces comptes ?","powered_by":"utilisant \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"copié"},"user_fields":{"none":"(choisir une option)"},"user":{"said":"{{username}} :","profile":"Profil","mute":"Silencieux","edit":"Modifier les préférences","download_archive":{"button_text":"Tout télécharger","confirm":"Êtes-vous sûr de vouloir télécharger vos messages ?","success":"Le téléchargement a démarré ; vous serez notifié par message lorsqu'il est terminé.","rate_limit_error":"Les messages peuvent être téléchargés une fois par jour, veuillez ressayer demain."},"new_private_message":"Créer un message direct","private_message":"Message direct","private_messages":"Messages directs","user_notifications":{"ignore_duration_title":"Ignorer planification","ignore_duration_username":"Pseudo","ignore_duration_when":"Durée :","ignore_duration_save":"Ignorer","ignore_duration_note":"Noter que tous les 'ignorer' sans supprimés automatiquement après l'échéance de la durée d'ignore.","ignore_duration_time_frame_required":"Veuillez sélectionner un intervalle de temps","ignore_no_users":"Vous n'avez aucun utilisateur ignoré.","ignore_option":"Ignoré","ignore_option_title":"Vous ne recevrez pas de notification en lien avec cet utilisateur et ses messages et réponses seront cachés.","add_ignored_user":"Ajouter...","mute_option":"Silencieux","mute_option_title":"Vous ne recevrez pas de notifications en lien avec cet utillisateur.","normal_option":"Normal","normal_option_title":"Vous serez notifié si cet utilisateur vous répond, vous cite, ou mentionne votre @pseudo."},"activity_stream":"Activité","preferences":"Préférences","feature_topic_on_profile":{"open_search":"Sélectionnez un nouveau sujet","title":"Sélectionnez un sujet","search_label":"Rechercher des sujet grâce au titre","save":"Sauvegarder","clear":{"title":"Vider","warning":"Êtes-vous sûr de vouloir effacer ce sujet à la une ?"}},"profile_hidden":"Le profil public de cet usagé est caché.","expand_profile":"Développer","collapse_profile":"Réduire","bookmarks":"Signets","bio":"À propos de moi","timezone":"Fuseau horaire","invited_by":"Invité par","trust_level":"Niveau de confiance","notifications":"Notifications","statistics":"Statistiques","desktop_notifications":{"label":"Notifications actives","not_supported":"Les notifications ne sont pas supportées avec ce navigateur. Désolé.","perm_default":"Activer les notifications","perm_denied_btn":"Permission refusée","perm_denied_expl":"Vous n'avez pas autorisé les notifications. Autorisez-les depuis les paramètres de votre navigateur.","disable":"Désactiver les notifications","enable":"Activer les notifications","each_browser_note":"Note : Vous devez changer ce paramètre sur chaque navigateur que vous utilisez.","consent_prompt":"Souhaitez-vous recevoir des notifications actives quand on répond à vos messages ?"},"dismiss":"Ignorer","dismiss_notifications":"Tout ignorer","dismiss_notifications_tooltip":"Marquer les notifications comme lues","first_notification":"Votre première notification ! Cliquez-la pour démarrer.","dynamic_favicon":"Faire apparaître le nombre sur l'icône navigateur","theme_default_on_all_devices":"En faire mon thème par défaut sur tous mes périphériques","text_size_default_on_all_devices":"En faire la taille de texte par défaut sur tous mes périphériques","allow_private_messages":"Permettre aux autres utilisateurs de m’envoyer des messages directs","external_links_in_new_tab":"Ouvrir tous les liens externes dans un nouvel onglet","enable_quoting":"Proposer de citer le texte sélectionné","enable_defer":"Activer reporter pour marquer des sujets non lu","change":"modifier","featured_topic":"Sujet à la une","moderator":"{{user}} est un modérateur","admin":"{{user}} est un administrateur","moderator_tooltip":"Cet utilisateur est un modérateur","admin_tooltip":"Cet utilisateur est un administrateur","silenced_tooltip":"Cet utilisateur est mis sous silence","suspended_notice":"L'utilisateur est suspendu jusqu'au {{date}}.","suspended_permanently":"Cet utilisateur est suspendu.","suspended_reason":"Raison :","github_profile":"GitHub","email_activity_summary":"Résumé d'activité","mailing_list_mode":{"label":"Liste de diffusion","enabled":"Activer la liste de diffusion","instructions":"\nCe réglage outrepasse le résumé d'activités.\u003cbr /\u003e\n\nLes sujets et catégories passés en silencieux ne sont pas inclus dans ces courriels.\n","individual":"Envoyer un courriel pour chaque nouveau message","individual_no_echo":"Envoyer un courriel pour chaque nouveau message sauf les miens","many_per_day":"M'envoyer un courriel pour chaque nouveau message (environ {{dailyEmailEstimate}} par jour)","few_per_day":"M'envoyer un courriel pour chaque nouveau message (environ 2 par jour)","warning":"Mode liste de diffusion activé. Les paramètres de notification par e-mail sont remplacés."},"tag_settings":"Étiquettes","watched_tags":"Surveillés","watched_tags_instructions":"Vous surveillerez automatiquement tous les sujets avec ces étiquettes. Vous serez notifié de tous les nouveaux messages et sujets, et le nombre de nouveaux messages apparaîtra à coté du sujet.","tracked_tags":"Suivis","tracked_tags_instructions":"Vous allez suivre automatiquement tous les sujets avec ces étiquettes. Le nombre de nouveaux messages apparaîtra à côté du sujet.","muted_tags":"Silencieux","muted_tags_instructions":"Vous ne serez notifié de rien concernant les nouveaux sujets avec ces étiquettes, et ils n'apparaîtront pas dans la liste des sujets récents.","watched_categories":"Surveillées","watched_categories_instructions":"Vous surveillerez automatiquement tous les sujets de ces catégories. Vous serez notifié de tous les nouveaux messages et sujets, et le nombre de nouveaux messages apparaîtra à coté du sujet.","tracked_categories":"Suivies","tracked_categories_instructions":"Vous allez suivre automatiquement tous les sujets dans ces catégories. Le nombre de nouveaux messages apparaîtra à côté du sujet.","watched_first_post_categories":"Surveiller les nouveaux sujets","watched_first_post_categories_instructions":"Vous serez notifié du premier message de chaque sujet dans ces catégories.","watched_first_post_tags":"Surveiller les nouveaux sujets","watched_first_post_tags_instructions":"Vous serez notifié du premier message de chaque sujet avec ces étiquettes.","muted_categories":"Silencieuses","muted_categories_instructions":"Vous ne serez aucunement notifié à propos de nouveaux sujets dans ces catégories et ils n'apparaîtront pas sur les pages \"Catégories\" ou \"Dernier\".","muted_categories_instructions_dont_hide":"Nous ne serez jamais notifié de quoi que ce soit à propos des nouveaux sujets dans cette catégorie.","no_category_access":"En tant que modérateur votre accès à la catégorie est limitée, la sauvegarde est désactivée.","delete_account":"Supprimer mon compte","delete_account_confirm":"Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action ne peut pas être annulée !","deleted_yourself":"Votre compte a été supprimé avec succès.","delete_yourself_not_allowed":"Veuiller contacter un responsable si vous souhaiter faire supprimer votre compte.","unread_message_count":"Messages","admin_delete":"Supprimer","users":"Utilisateurs","muted_users":"Silencieux","muted_users_instructions":"Cacher toutes les notifications de ces utilisateurs.","ignored_users":"Ignoré","ignored_users_instructions":"Cacher toutes les publications et les notifications de ces utilisateurs.","tracked_topics_link":"Afficher","automatically_unpin_topics":"Désépingler automatiquement les sujets quand j'arrive à la fin.","apps":"Applications","revoke_access":"Révoquer l'accès","undo_revoke_access":"Annuler la révocation d'accès","api_approved":"Approuvé :","api_last_used_at":"Dernièrement utilisé le :","theme":"Thème","home":"Page d'accueil par défaut","staged":"Distant","staff_counters":{"flags_given":"signalements utiles","flagged_posts":"messages signalés","deleted_posts":"messages supprimés","suspensions":"suspensions","warnings_received":"avertissements"},"messages":{"all":"Tous","inbox":"Boîte de réception","sent":"Envoyés","archive":"Archive","groups":"Mes groupes","bulk_select":"Sélectionner des messages","move_to_inbox":"Déplacer dans la boîte de réception","move_to_archive":"Archiver","failed_to_move":"Impossible de déplacer les messages sélectionnés (peut-être que votre connexion est coupée)","select_all":"Tout sélectionner","tags":"Étiquettes"},"preferences_nav":{"account":"Compte","profile":"Profil","emails":"Courriels","notifications":"Notifications","categories":"Catégories","users":"Utilisateurs","tags":"Étiquettes","interface":"Interface","apps":"Applications"},"change_password":{"success":"(courriel envoyé)","in_progress":"(courriel en cours d'envoi)","error":"(erreur)","action":"Envoyer un courriel de réinitialisation du mot de passe","set_password":"Définir le mot de passe","choose_new":"Choisissez un nouveau mot de passe","choose":"Choisissez un mot de passe"},"second_factor_backup":{"title":"Codes de secours de l'authentification à deux facteurs","regenerate":"Regénérer","disable":"Désactiver","enable":"Activer","enable_long":"Activer les codes de secours","manage":"Gérer les codes de sauvegarde. Il vous reste \u003cstrong\u003e{{count}}\u003c/strong\u003e code(s) de sauvegarde.","copied_to_clipboard":"Copié dans le presse-papiers","copy_to_clipboard_error":"Erreur en copiant les données dans le presse-papiers","remaining_codes":"Vous avez \u003cstrong\u003e{{count}}\u003c/strong\u003e codes de secours restants.","use":"Utiliser un code de secours","enable_prerequisites":"Vous devez activer un second facteur principal avant de générer des codes de sauvegarde.","codes":{"title":"Codes de secours générés","description":"Chaque code de secours ne peut être utilisé qu'une seule fois. Garder les dans un endroit sûr mais accessible."}},"second_factor":{"title":"Authentification à deux facteurs","enable":"Paramètres d'authentification à deux facteurs","forgot_password":"Mot de passe oublié ?","confirm_password_description":"Merci de confirmer votre mot de passe pour continuer","name":"Nom","label":"Code","rate_limit":"Veuillez patienter avant d'essayer un autre code d'identification.","enable_description":"Scannez ce code QR en utilisant une application supportée (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e– \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) et entrez votre code d'authentification.\n","disable_description":"Veuillez saisir le code d'authentification de votre app","show_key_description":"Saisir manuellement","short_description":"Protéger votre compte avec des codes de sécurité à usage unique.\n","extended_description":"L'authentification à deux facteurs ajoute une sécurité supplémentaire à votre compte en exigeant un jeton unique en \nplus de votre mot de passe. Les jetons peuvent être générés sur les appareils \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e et \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e.\n","oauth_enabled_warning":"Veuillez noter que les connexions sociales seront désactivées une fois que l'authentification à deux facteurs aura été activée sur votre compte.","use":"Utiliser l'application Authenticator","enforced_notice":"Vous devez activer l'authentification à deux facteurs pour accéder à ce site.","disable":"désactiver","disable_title":"Désactiver le second facteur","disable_confirm":"Êtes-vous sûr de vouloir désactiver tous les facteurs secondaires ?","edit":"Modifier","edit_title":"Modifier le second facteur","edit_description":"Nom du second facteur","enable_security_key_description":"Dès que votre clé de sécurité physique est prête, appuyer sur le bouton Enregistrer ci-dessous.","totp":{"title":"Authentificateurs à base de jetons","add":"Nouveau Authentificateur","default_name":"Mon Authentificateur"},"security_key":{"register":"Enregistrer","title":"Clés de sécurité","add":"Enregistrer une clé de sécurité","default_name":"Clé de sécurité principale","not_allowed_error":"La procédure d'enregistrement de la clé de sécurité a expiré ou a été annulée.","already_added_error":"Vous avez déjà enregistré cette clé de sécurité. Vous n'avez pas besoin de le faire à nouveau.","edit":"Modifier la clé de sécurité","edit_description":"Nom de la clé de sécurité","delete":"Supprimer"}},"change_about":{"title":"Modifier À propos de moi","error":"Il y a eu une erreur lors de la modification de cette valeur."},"change_username":{"title":"Modifier le pseudo","confirm":"Êtes-vous sûr de vouloir modifier votre pseudo ?","taken":"Désolé, ce pseudo est déjà pris.","invalid":"Ce pseudo est invalide. Il ne doit être composé que de lettres et de chiffres."},"change_email":{"title":"Modifier l'adresse de courriel","taken":"Désolé, cette adresse de courriel est indisponible.","error":"Il y a eu une erreur lors du changement d'adresse de courriel. Cette adresse est peut-être déjà utilisée ?","success":"Nous avons envoyé un courriel à cette adresse. Merci de suivre les instructions.","success_staff":"Nous avons envoyé un courriel à votre adresse actuelle. Merci de suivre les instructions."},"change_avatar":{"title":"Modifier votre image de profil","letter_based":"Image de profil attribuée par le système","uploaded_avatar":"Avatar personnalisé","uploaded_avatar_empty":"Ajouter un avatar personnalisé","upload_title":"Envoyer votre avatar","image_is_not_a_square":"Attention : nous avons découpé votre image ; la largeur et la hauteur n'étaient pas égales."},"change_profile_background":{"title":"Arrière-plan du profil","instructions":"Les arrière-plans du profil seront centrés avec une largeur par défaut de 1110 pixels."},"change_card_background":{"title":"Arrière-plan de la carte de l'utilisateur","instructions":"Les images d'arrière-plan seront centrées avec une largeur par défaut de 590 pixels."},"change_featured_topic":{"title":"Sujet à la une","instructions":"Un lien vers ce sujet sera ajouté sur votre carte d'utilisateur et votre profil."},"email":{"title":"Courriel","primary":"Adresse courriel principale","secondary":"Adresses courriel secondaires","no_secondary":"Aucune adresse courriel secondaire","sso_override_instructions":"Le courriel peut être mis à jour à partir du fournisseur SSO.","instructions":"Jamais visible publiquement.","ok":"Nous vous enverrons un courriel de confirmation","invalid":"Merci d'entrer une adresse de courriel valide","authenticated":"Votre adresse de courriel a été authentifiée par {{provider}}","frequency_immediately":"Nous vous enverrons un courriel immédiatement si vous n'avez pas lu le contenu en question.","frequency":{"one":"Nous vous enverrons des courriels seulement si nous ne vous avons pas vu sur le site dans la dernière minute.","other":"Nous vous enverrons des courriels seulement si nous ne vous avons pas vu sur le site dans les dernières {{count}} minutes."}},"associated_accounts":{"title":"Comptes associés","connect":"Connecter","revoke":"Révoquer","cancel":"Annuler","not_connected":"(non connecté)","confirm_modal_title":"Connectez le compte %{provider}","confirm_description":{"account_specific":"Votre compte %{provider} '%{account_description}' sera utilisé pour l'authentification.","generic":"Votre compte %{provider} sera utilisé pour l'authentification."}},"name":{"title":"Nom d'utilisateur","instructions":"votre nom complet (facultatif)","instructions_required":"Votre nom complet","too_short":"Votre nom est trop court","ok":"Votre nom a l'air correct"},"username":{"title":"Pseudo","instructions":"unique, sans espaces, court","short_instructions":"Les gens peuvent vous mentionner avec @{{username}}","available":"Votre pseudo est disponible","not_available":"Indisponible. Essayez {{suggestion}} ?","not_available_no_suggestion":"Non disponible","too_short":"Votre pseudo est trop court","too_long":"Votre pseudo est trop long","checking":"Vérification de la disponibilité du pseudo…","prefilled":"L'adresse de courriel correspond à ce pseudo enregistré"},"locale":{"title":"Langue de l'interface","instructions":"Langue de l'interface utilisateur. Le changement sera pris en compte lorsque vous actualiserez la page.","default":"(par défaut)","any":"tous"},"password_confirmation":{"title":"Confirmation du mot de passe"},"auth_tokens":{"title":"Appareils utilisés récemment","ip":"IP","details":"Détails","log_out_all":"Déconnecter tous","active":"actuellement actif(s)","not_you":"Pas vous ?","show_all":"Tout afficher ({{count}})","show_few":"Afficher moins","was_this_you":"Etait-ce vous ?","was_this_you_description":"Si ce n'était pas vous, nous vous conseillons de modifier votre mot de passe et de vous déconnecter partout.","browser_and_device":"{{browser}} sur {{device}}","secure_account":"Sécuriser mon compte","latest_post":"Votre dernier message..."},"last_posted":"Dernier message","last_emailed":"Dernier courriel","last_seen":"Vu","created":"Inscrit","log_out":"Se déconnecter","location":"Localisation","website":"Site internet","email_settings":"Courriel","hide_profile_and_presence":"Cacher mon profil public et statistiques","enable_physical_keyboard":"Activer le support du clavier physique sur iPad","text_size":{"title":"Taille de texte","smaller":"Petit","normal":"Normal","larger":"Grand","largest":"Plus grand"},"title_count_mode":{"title":"Titre de page de fond affiche nombre de :","notifications":"Nouvelles notifications","contextual":"Nouveau contenu de page"},"like_notification_frequency":{"title":"Notifier lors d'un J'aime","always":"Toujours","first_time_and_daily":"La première fois qu'un message est aimé puis quotidiennement","first_time":"La première fois qu'un message est aimé","never":"Jamais"},"email_previous_replies":{"title":"Inclure les réponses précédentes en bas des courriels","unless_emailed":"sauf si déjà envoyées","always":"toujours","never":"jamais"},"email_digests":{"title":"Lorsque je ne visite pas le site, m'envoyer un courriel avec un résumé des sujets et réponses populaires","every_30_minutes":"toutes les 30 minutes","every_hour":"toutes les heures","daily":"quotidien","weekly":"hebdomadaire","every_month":"tous les mois","every_six_months":"tous les six mois"},"email_level":{"title":"M'envoyer un courriel quand quelqu'un me cite, répond à l'un de mes messages, mentionne mon @pseudo ou m'invite à rejoindre un sujet.","always":"toujours","only_when_away":"seulement si absent","never":"jamais"},"email_messages_level":"M'envoyer un courriel quand quelqu'un m'envoie un message direct.","include_tl0_in_digests":"Inclure les contributions des nouveaux utilisateurs dans les résumés par courriel","email_in_reply_to":"Inclure un extrait du message auquel il a été répondu dans les courriels","other_settings":"Autre","categories_settings":"Catégories","new_topic_duration":{"label":"Considérer les sujets comme nouveaux quand","not_viewed":"je ne les ai pas encore vus","last_here":"créés depuis ma dernière visite","after_1_day":"créés depuis hier","after_2_days":"créés durant les 2 derniers jours","after_1_week":"créés durant les 7 derniers jours","after_2_weeks":"créés durant les 2 dernières semaines"},"auto_track_topics":"Suivre automatiquement les sujets que je consulte","auto_track_options":{"never":"jamais","immediately":"immédiatement","after_30_seconds":"après 30 secondes","after_1_minute":"après 1 minute","after_2_minutes":"après 2 minutes","after_3_minutes":"après 3 minutes","after_4_minutes":"après 4 minutes","after_5_minutes":"après 5 minutes","after_10_minutes":"après 10 minutes"},"notification_level_when_replying":"Quand j'ai répondu dans un sujet, le régler sur","invited":{"search":"commencer à saisir pour rechercher vos invitations…","title":"Invitations","user":"Utilisateurs","sent":"Derniers envoyés","none":"Il n'y a pas d'invitations en attente à afficher.","truncated":{"one":"Afficher la première invitation.","other":"Afficher les {{count}} premières invitations."},"redeemed":"Invitations acceptées","redeemed_tab":"Utilisées","redeemed_tab_with_count":"Invitations acceptées ({{count}})","redeemed_at":"Acceptée le","pending":"Invitations en attente","pending_tab":"En attente","pending_tab_with_count":"En attente ({{count}})","topics_entered":"Sujets consultés","posts_read_count":"Messages lus","expired":"Cette invitation a expiré.","rescind":"Supprimer","rescinded":"Invitation annulée","rescind_all":"Supprimer toutes les invitations expirées","rescinded_all":"Invitations expirées supprimées !","rescind_all_confirm":"Êtes-vous sûr de vouloir supprimer toutes les invitations expirées ?","reinvite":"Renvoyer l'invitation","reinvite_all":"Renvoyer toutes les invitations","reinvite_all_confirm":"Êtes-vous sûr de renvoyer toutes les invitations ?","reinvited":"Invitation renvoyée","reinvited_all":"Invitations renvoyées !","time_read":"Temps de lecture","days_visited":"Ratio de présence","account_age_days":"Âge du compte en jours","create":"Envoyer une invitation","generate_link":"Copier le lien d'invitation","link_generated":"Lien d'invitation généré avec succés !","valid_for":"Le lien d'invitation est seulement valide pour cette adresse courriel : %{email}","bulk_invite":{"none":"Vous n'avez encore invité personne. Envoyez des invitations individuelles ou à plusieurs personnes en même temps en \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eenvoyant un fichier CSV.\u003c/a\u003e","text":"Invitation massive depuis un fichier","success":"Le fichier a été correctement importé. Vous serez notifié par message direct lorsque le traitement sera terminé.","error":"Désolé, le fichier doit être au format CSV.","confirmation_message":"Vous êtes sur le point d'envoyer un courriel à toutes les adresses dans le fichier téléchargé."}},"password":{"title":"Mot de passe","too_short":"Votre mot de passe est trop court.","common":"Ce mot de passe est trop commun.","same_as_username":"Votre mot de passe est le même que votre pseudo.","same_as_email":"Votre mot de passe est le même que votre adresse mail.","ok":"Votre mot de passe semble correct.","instructions":"au moins %{count} caractères."},"summary":{"title":"Résumé","stats":"Statistiques","time_read":"de lecture","recent_time_read":"temps de lecture récent","topic_count":{"one":"sujets créés","other":"sujets créés"},"post_count":{"one":"message créé","other":"messages créés"},"likes_given":{"one":"donné","other":"donnés"},"likes_received":{"one":"reçu","other":"reçus"},"days_visited":{"one":"jour visité","other":"jours visités"},"topics_entered":{"one":"sujet vu","other":"sujets vus"},"posts_read":{"one":"message lu","other":"messages lus"},"bookmark_count":{"one":"signet","other":"signets"},"top_replies":"Meilleures réponses","no_replies":"Pas encore de réponses.","more_replies":"Plus de réponses","top_topics":"Meilleurs sujets","no_topics":"Pas encore de sujets.","more_topics":"Plus de sujets","top_badges":"Meilleurs badges","no_badges":"Pas encore de badges.","more_badges":"Plus de badges","top_links":"Meilleurs liens","no_links":"Pas encore de liens.","most_liked_by":"Le plus aimé par","most_liked_users":"A le plus aimé","most_replied_to_users":"A le plus répondu à","no_likes":"Pas encore de J'aime.","top_categories":"Meilleures catégories","topics":"Sujets","replies":"Réponses"},"ip_address":{"title":"Dernières adresses IP"},"registration_ip_address":{"title":"Adresse IP d'enregistrement"},"avatar":{"title":"Image de profil","header_title":"profil, messages, signets et préférences"},"title":{"title":"Titre","none":"(aucun)"},"primary_group":{"title":"Groupe principal","none":"(aucun)"},"filters":{"all":"Tous"},"stream":{"posted_by":"Rédigé par","sent_by":"Envoyé par","private_message":"message direct","the_topic":"le sujet"}},"loading":"Chargement…","errors":{"prev_page":"lors du chargement de","reasons":{"network":"Erreur réseau","server":"Erreur serveur","forbidden":"Accès refusé","unknown":"Erreur","not_found":"Page introuvable"},"desc":{"network":"Veuillez vérifier votre connexion.","network_fixed":"On dirait que c'est revenu.","server":"Code d'erreur : {{status}}","forbidden":"Vous n'êtes pas autorisé à voir cela.","not_found":"Oups, l'application a essayé de charger une URL qui n'existe pas.","unknown":"Une erreur est survenue."},"buttons":{"back":"Retour","again":"Réessayer","fixed":"Charger la page"}},"modal":{"close":"fermer"},"close":"Fermer","assets_changed_confirm":"Ce site vient d'être mis à jour. Rafraîchir maintenant pour accéder à la nouvelle version ?","logout":"Vous avez été déconnecté.","refresh":"Rafraîchir","read_only_mode":{"enabled":"Le site est en mode lecture seule. Vous pouvez continer à naviguer, mais les réponses, J'aime et autre interactions sont désactivées pour l'instant.","login_disabled":"La connexion est désactivée quand le site est en lecture seule.","logout_disabled":"La déconnexion est désactivée quand le site est en lecture seule."},"logs_error_rate_notice":{},"learn_more":"en savoir plus…","all_time":"total","all_time_desc":"nombre total de sujets créés","year":"an","year_desc":"sujets créés durant les 365 derniers jours","month":"mois","month_desc":"sujets créés durant les 30 derniers jours","week":"semaine","week_desc":"sujets créés durant les 7 derniers jours","day":"jour","first_post":"Premier message","mute":"Désactiver","unmute":"Activer","last_post":"Dernier message","time_read":"Temps de lecture","time_read_recently":"%{time_read} récemment","time_read_tooltip":"%{time_read} temps de lecture total","time_read_recently_tooltip":"%{time_read} temps de lecture total (%{recent_time_read} durant les 60 derniers jours)","last_reply_lowercase":"réponse","replies_lowercase":{"one":"réponse","other":"réponses"},"signup_cta":{"sign_up":"S'inscrire","hide_session":"Me le rappeler demain","hide_forever":"non merci","hidden_for_session":"Très bien, je vous demanderai demain. Vous pouvez toujours cliquer sur « Se connecter » pour créer un compte.","intro":"Bonjour ! Vous semblez apprécier la discussion, mais n'avez pas encore créé de compte.","value_prop":"Quand vous créez votre compte, nous stockons ce que vous avez lu pour qu'à votre retour vous puissiez continuer là on vous vous êtes arrêtés. Vous recevez aussi des notifications, ici et par courriel, dès que quelqu'un vous répond. Et vous pouvez aimer les messages pour partager vos coups de cœurs. :heartpulse:"},"summary":{"enabled_description":"Vous visualisez un résumé de ce sujet : les messages les plus intéressants choisis par la communauté.","description":"Il y a \u003cb\u003e{{replyCount}}\u003c/b\u003e réponses.","description_time":"Il y a \u003cb\u003e{{replyCount}}\u003c/b\u003e réponses avec un temps de lecture estimé à \u003cb\u003e{{readingTime}} minutes\u003c/b\u003e.","enable":"Résumer ce sujet","disable":"Afficher tous les messages"},"deleted_filter":{"enabled_description":"Ce sujet contient des messages supprimés, qui ont été cachés.","disabled_description":"Les messages supprimés du sujet sont visibles.","enable":"Cacher les messages supprimés","disable":"Afficher les messages supprimés"},"private_message_info":{"title":"Message direct","invite":"Inviter d'autres utilisateurs…","edit":"Ajouter ou supprimer…","leave_message":"Êtes-vous sûr de vouloir quitter cette conversation ?","remove_allowed_user":"Êtes-vous sûr de vouloir supprimer {{name}} de ce message direct ?","remove_allowed_group":"Êtes-vous sûr de vouloir supprimer {{name}} de ce message direct ?"},"email":"Courriel","username":"Pseudo","last_seen":"Vu","created":"Créé","created_lowercase":"créé","trust_level":"Niveau de confiance","search_hint":"pseudo, courriel ou adresse IP","create_account":{"disclaimer":"En vous s'inscrivant, vous acceptez la \u003ca href='{{privacy_link}}' target='blank'\u003epolitique de confidentialité\u003c/a\u003e et les \u003ca href='{{tos_link}}' target='blank'\u003econditions générales d'utilisation\u003c/a\u003e.","title":"Créer un nouveau compte","failed":"Quelque chose s'est mal passé, peut-être que cette adresse de courriel est déjà enregistrée, essayez le lien Mot de passe oublié."},"forgot_password":{"title":"Réinitialisation du mot de passe","action":"J'ai oublié mon mot de passe","invite":"Saisir votre pseudo ou votre adresse de courriel, et vous recevrez un nouveau mot de passe par courriel.","reset":"Réinitialiser votre mot de passe","complete_username":"Si un compte correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_email":"Si un compte correspond à l'adresse de courriel \u003cb\u003e%{email}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_username_found":"Nous avons trouvé un compte correspondant au pseudo \u003cb\u003e%{username}\u003c/b\u003e. Vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_email_found":"Nous avons trouvé un compte correspondant au courriel \u003cb\u003e%{email}\u003c/b\u003e. Vous devriez recevoir rapidement un courriel avec les instructions pour réinitialiser votre mot de passe.","complete_username_not_found":"Aucun compte ne correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Aucun compte ne correspond à \u003cb\u003e%{email}\u003c/b\u003e","help":"Le courriel n'est pas arrivé ? Pensez bien à vérifier dans votre dossier de spam.\u003cp\u003eVous n'êtes pas sûr de l'adresse électronique que vous avez utilisée ? Saisissez ici une adresse électronique, et nous vous dirons si elle existe ici.\u003c/p\u003e\u003cp\u003eSi vous n'avez plus accès à l'adresse électronique de votre compte, merci de contacter \u003ca href='%{basePath}/about'\u003enos responsables serviables.\u003c/a\u003e\u003c/p\u003e","button_ok":"OK","button_help":"Aide"},"email_login":{"link_label":"M'envoyer un lien de connexion par courriel","button_label":"par courriel","complete_username":"Si un compte correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec un lien pour vous connecter.","complete_email":"Si un compte correspond à l'adresse de courriel \u003cb\u003e%{email}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec un lien pour vous connecter.","complete_username_found":"Nous avons trouvé un compte correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec un lien pour vous connecter.","complete_email_found":"Nous avons trouvé un compte correspond au courriel \u003cb\u003e%{email}\u003c/b\u003e, vous devriez recevoir rapidement un courriel avec un lien pour vous connecter.","complete_username_not_found":"Aucun compte ne correspond au pseudo \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Aucun compte ne correspond à \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Continuer vers %{site_name}","logging_in_as":"Connexion en tant que %{email}","confirm_button":"Complétez la connexion"},"login":{"title":"Se connecter","username":"Utilisateur","password":"Mot de passe","second_factor_title":"Authentification à deux facteurs","second_factor_description":"Veuillez saisir le code d'authentification de votre app :","second_factor_backup":"Se connecter avec un code de secours","second_factor_backup_title":"Authentification à deux facteurs (code de secours)","second_factor_backup_description":"Veuillez entrer un de vos codes de secours :","second_factor":"Se connecter avec une application","security_key_description":"Dès que votre clé de sécurité physique est prête, appuyer sur le bouton S'authentifier avec une clé de sécurité ci-dessous.","security_key_alternative":"Essayer une autre méthode","security_key_authenticate":"S'authentifier avec une clé de sécurité","security_key_not_allowed_error":"La procédure d'authentification de la clé de sécurité a expiré ou a été annulée.","security_key_no_matching_credential_error":"Aucun identifiant correspondant n'a pu être trouvé dans la clé de sécurité donnée.","security_key_support_missing_error":"Votre appareil ou navigateur actuel ne supporte pas l'utilisation de clés de sécurité. Veuillez utiliser une autre méthode.","email_placeholder":"courriel ou pseudo","caps_lock_warning":"Majuscules vérrouillées","error":"Erreur inconnue","cookies_error":"Les cookies de votre navigateur semblent désactiver. Vous ne pourrez pas vous connecter sans les activer.","rate_limit":"Merci de patienter avant de vous reconnecter.","blank_username":"Merci de saisir votre courriel ou pseudo.","blank_username_or_password":"Merci de saisir votre courriel ou pseudo, et mot de passe.","reset_password":"Réinitialiser le mot de passe","logging_in":"Connexion en cours…","or":"ou","authenticating":"Authentification…","awaiting_activation":"Votre compte est en attente d'activation, utilisez le lien mot de passe oublié pour envoyer un autre courriel d'activation.","awaiting_approval":"Votre compte n'a pas encore été approuvé par un modérateur. Vous recevrez une confirmation par courriel lors de l'activation.","requires_invite":"Désolé, l'accès à ce forum est sur invitation seulement.","not_activated":"Vous ne pouvez pas vous encore vous connecter. Nous avons envoyé un courriel d'activation à \u003cb\u003e{{sentTo}}\u003c/b\u003e. Merci de suivre les instructions afin d'activer votre compte.","not_allowed_from_ip_address":"Vous ne pouvez pas vous connecter depuis cette adresse IP.","admin_not_allowed_from_ip_address":"Vous ne pouvez pas vous connecter comme administrateur depuis cette adresse IP.","resend_activation_email":"Cliquez ici pour envoyer à nouveau le courriel d'activation.","omniauth_disallow_totp":"L'authentification à deux facteurs est activée sur votre compte. Veuillez vous connecter avec votre mot de passe.","resend_title":"Renvoyer le courriel d'activation","change_email":"Changer l'adresse de courriel","provide_new_email":"Donnez une nouvelle adresse et nous allons renvoyer votre courriel de confirmation.","submit_new_email":"Mettre à jour l'adresse de courriel","sent_activation_email_again":"Nous venons d'envoyer un nouveau courriel d'activation à \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Il peut prendre quelques minutes à arriver ; n'oubliez pas de vérifier votre répertoire spam.","sent_activation_email_again_generic":"Nous avons envoyé un autre courriel d'activation. Il se peut que cela prenne quelques minutes pour arriver ; vérifier aussi votre spam.","to_continue":"Veuillez vous connecter","preferences":"Vous devez être connecté pour modifier vos préférences utilisateur.","forgot":"J'ai oublié les détails de mon compte","not_approved":"Votre compte n'a pas encore été approuvé. Vous serez notifié par mail lorsque vous pourrez vous connecter.","google_oauth2":{"name":"Google","title":"via Google"},"twitter":{"name":"Twitter","title":"via Twitter"},"instagram":{"name":"Instagram","title":"via Instagram"},"facebook":{"name":"Facebook","title":"via Facebook"},"github":{"name":"GitHub","title":"via GitHub"},"discord":{"name":"Discord","title":"avec Discord"},"second_factor_toggle":{"totp":"Utilisez plutôt une application d'authentification","backup_code":"Utilisez plutôt un code de secours"}},"invites":{"accept_title":"Invitation","welcome_to":"Bienvenue sur %{site_name} !","invited_by":"Vous avez été invité par :","social_login_available":"Vous pourrez aussi vous connecter avec un réseau social utilisant cette adresse.","your_email":"L'adresse courriel de votre compte est \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Accepter l'invitation","success":"Votre compte a été créé et vous êtes maintenant connecté.","name_label":"Nom","password_label":"Définir le mot de passe","optional_description":"(facultatif)"},"password_reset":{"continue":"Continuer vers %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (précédemment EmojiOne)","win10":"Win10","google_classic":"Classique Google","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Catégories seules","categories_with_featured_topics":"Catégories avec sujets à la une","categories_and_latest_topics":"Catégories et sujets récents","categories_and_top_topics":"Catégories et meilleurs sujets","categories_boxes":"Boîtes avec sous-catégories","categories_boxes_with_topics":"Boîtes avec sujets à la une"},"shortcut_modifier_key":{"shift":"Maj","ctrl":"Ctrl","alt":"Alt","enter":"Enter"},"conditional_loading_section":{"loading":"Chargement…"},"category_row":{"topic_count":"{{count}} sujets dans cette catégorie"},"select_kit":{"default_header_text":"Sélectionner…","no_content":"Aucune correspondance trouvée","filter_placeholder":"Rechercher...","filter_placeholder_with_any":"Rechercher ou créer…","create":"Créer : « {{content}} »","max_content_reached":{"one":"Vous ne pouvez séléctionner que {{count}} élément.","other":"Vous ne pouvez séléctionner que {{count}} éléments."},"min_content_not_reached":{"one":"Séléctionner au moins {{count}} élément.","other":"Séléctionner au moins {{count}} éléments."},"invalid_selection_length":"La sélection doit faire au minimum {{count}} caractères ."},"date_time_picker":{"from":"From","to":"À","errors":{"to_before_from":"La date de fin doit être postérieure à celle de début."}},"emoji_picker":{"filter_placeholder":"Chercher un emoji","smileys_\u0026_emotion":"Frimousses et Émotions","people_\u0026_body":"Personnes et Corps","animals_\u0026_nature":"Animaux et Nature","food_\u0026_drink":"Nourriture et Boisson","travel_\u0026_places":"Voyage et Lieux","activities":"Activités","objects":"Objets","symbols":"Symboles","flags":"Drapeaux","recent":"Utilisés récemment","default_tone":"Aucun teint","light_tone":"Teint clair","medium_light_tone":"Teint légèrement clair","medium_tone":"Teint moyen","medium_dark_tone":"Teint légèrement foncé","dark_tone":"Teint foncé","default":"Emojis personnalisés"},"shared_drafts":{"title":"Ébauches partagées","notice":"Ce sujet n'est visible que pour ceux qui peuvent voir la catégorie \u003cb\u003e{{category}}\u003c/b\u003e.","destination_category":"Catégorie déstinataire","publish":"Publier ébauche partagée","confirm_publish":"Êtes-vous sûr de vouloir publier cette ébauche ?","publishing":"Sujet en cours de publication..."},"composer":{"emoji":"Emoji :)","more_emoji":"plus…","options":"Options","whisper":"murmure","unlist":"invisible","blockquote_text":"Citation","add_warning":"Ceci est un avertissement officiel.","toggle_whisper":"Basculer murmure","toggle_unlisted":"Basculer la visibilité","posting_not_on_topic":"À quel sujet voulez-vous répondre ?","saved_local_draft_tip":"sauvegardé en local","similar_topics":"Votre sujet est similaire à…","drafts_offline":"brouillons hors ligne","edit_conflict":"conflit de modification","group_mentioned_limit":"\u003cb\u003eAttention !\u003c/b\u003e Vous avez mentionné \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, cependant ce groupe a plus de membres que le nombre de mentions limite de {{max}} utilisateurs configuré par l'administrateur. Personne ne sera notifié.","group_mentioned":{"one":"En mentionnant {{group}}, vous êtes sur le point de notifier \u003ca href='{{group_link}}'\u003e%{count} personne\u003c/a\u003e – êtes-vous sûr ?","other":"En mentionnant {{group}}, vous êtes sur le point de notifier \u003ca href='{{group_link}}'\u003e{{count}} personnes\u003c/a\u003e – êtes-vous sûr ?"},"cannot_see_mention":{"category":"Vous avez mentionné {{username}} mais il ne sera pas notifié car il n'a pas accès à cette catégorie. Vous devez ajouter cet utilisateur à un groupe ayant accès à cette catégorie.","private":"Vous avez mentionné {{username}} mais il ne sera pas notifié car il ne peut pas voir ce message direct. Vous devez inviter cet utilisateur à la discussion."},"duplicate_link":"Il semblerait que votre lien vers \u003cb\u003e{{domain}}\u003c/b\u003e a déjà été publié dans le sujet par \u003cb\u003e@{{username}}\u003c/b\u003e dans \u003ca href='{{post_url}}'\u003eune réponse de {{ago}}\u003c/a\u003e – êtes vous sûr de vouloir le publier à nouveau ?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Le titre est obligatoire.","title_too_short":"Le titre doit avoir au moins {{min}} caractères","title_too_long":"Le titre ne doit pas dépasser les {{max}} caractères","post_missing":"Le message ne peut être vide","post_length":"Le message doit avoir au moins {{min}} caractères","try_like":"Avez-vous essayé le bouton {{heart}} ?","category_missing":"Vous devez choisir une catégorie","tags_missing":"Vous devez choisir au moins {{count}} étiquettes","topic_template_not_modified":"Veuillez ajouter des détails à votre topic en modifiant le modèle de sujet."},"save_edit":"Sauvegarder","overwrite_edit":"Ecraser la modification","reply_original":"Répondre sur le sujet d'origine","reply_here":"Répondre ici","reply":"Répondre","cancel":"Annuler","create_topic":"Créer le sujet","create_pm":"Message direct","create_whisper":"Murmurer","create_shared_draft":"Créer ébauche partagée","edit_shared_draft":"Modifier ébauche partagée","title":"ou appuyez sur Ctrl+Entrée","users_placeholder":"Ajouter un utilisateur","title_placeholder":"Quel est le sujet en une courte phrase ?","title_or_link_placeholder":"Entrez un titre, ou copiez un lien ici","edit_reason_placeholder":"pourquoi modifiez-vous le message ?","topic_featured_link_placeholder":"Entrez un lien affiché avec le titre.","remove_featured_link":"Retirer le lien du sujet","reply_placeholder":"Écrivez ici. Utilisez Markdown, BBCode, ou HTML pour mettre en forme. Glissez ou collez des images.","reply_placeholder_no_images":"Écrivez ici. Utilisez Markdown, BBCode, ou HTML pour mettre en forme.","reply_placeholder_choose_category":"Sélectionner une catégorie avant de rédiger ici.","view_new_post":"Voir votre nouveau message.","saving":"Sauvegarde","saved":"Sauvegardé !","saved_draft":"Brouillon de message en cours. Appuyer pour reprendre.","uploading":"Envoi en cours…","show_preview":"afficher la prévisualisation \u0026raquo;","hide_preview":"\u0026laquo; cacher la prévisualisation","quote_post_title":"Citer le message en entier","bold_label":"G","bold_title":"Gras","bold_text":"texte en gras","italic_label":"I","italic_title":"Italique","italic_text":"texte en italique","link_title":"Lien","link_description":"saisir ici la description du lien","link_dialog_title":"Insérer le lien","link_optional_text":"titre optionnel","link_url_placeholder":"Coller une URL ou tapez pour chercher des sujets","quote_title":"Citation","quote_text":"Citation","code_title":"Texte préformaté","code_text":"texte préformaté indenté par 4 espaces","paste_code_text":"saisir ou coller le code ici","upload_title":"Envoi de fichiers","upload_description":"saisir ici la description de votre fichier","olist_title":"Liste numérotée","ulist_title":"Liste à puces","list_item":"Élément","toggle_direction":"Basculer sens","help":"Aide Markdown","collapse":"réduire le panneau d'édition","open":"ouvrir l'éditeur","abandon":"fermer le panneau d'édition et supprimer le brouillon","enter_fullscreen":"utiliser éditeur plein écran","exit_fullscreen":"sortir de l'éditeur plein écran","modal_ok":"OK","modal_cancel":"Annuler","cant_send_pm":"Désolé, vous ne pouvez pas envoyer de message à l'utilisateur %{username}.","yourself_confirm":{"title":"Avez-vous oublié d'ajouter des destinataires ?","body":"Pour le moment, ce message est uniquement envoyé à vous-même !"},"admin_options_title":"Paramètres optionnels pour ce sujet","composer_actions":{"reply":"Répondre","draft":"Ebauche","edit":"Modifier","reply_to_post":{"label":"Réponse à message %{postNumber} par %{postUsername}","desc":"Répondre à un message spécifique"},"reply_as_new_topic":{"label":"Répondre à un sujet lié","desc":"Créer un nouveau sujet lié à ce sujet"},"reply_as_private_message":{"label":"Nouveau message","desc":"Créer un nouveau message direct"},"reply_to_topic":{"label":"Répondre au sujet","desc":"Répondre au sujet, pas à un message spécifique"},"toggle_whisper":{"label":"Basculer murmure","desc":"Les mumures ne sont visibles qu'aux responsables"},"create_topic":{"label":"Nouveau sujet"},"shared_draft":{"label":"Ebauche partagée","desc":"Créer ébauche d'un sujet qui ne sera visible qu'aux responsables"},"toggle_topic_bump":{"label":"Basculer l'actualisation des sujets","desc":"Répondre sans changer la date de dernière réponse"}},"details_title":"Résumé","details_text":"Ce texte sera caché"},"notifications":{"tooltip":{"regular":{"one":"%{count} notification non vue","other":"{{count}} notifications non vues"},"message":{"one":"%{count} message non lu","other":"{{count}} messages non lus"}},"title":"notifications des mentions de votre @pseudo, des réponses à vos messages, à vos sujets, etc.","none":"Impossible de charger les notifications pour le moment.","empty":"Aucune notification trouvée.","post_approved":"Votre message a été approuvé","reviewable_items":"éléments en attente de vérification","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} et %{count} autre\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} et {{count}} autres\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"a aimé de vos messages","other":"a aimé {{count}} de vos messages"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e a accepté votre invitation","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e a deplacé {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Vous avez gagné « {{description}} »","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNouveau sujet\u003c/span\u003e {{description}}","membership_request_accepted":"Adhésion acceptée dans '{{group_name}}'","membership_request_consolidated":"{{count}} demandes d'adhésion ouvertes pour « {{group_name}} »","group_message_summary":{"one":"{{count}} message dans la boîte de réception de {{group_name}}","other":"{{count}} messages dans la boîte de réception de {{group_name}}"},"popup":{"mentioned":"{{username}} vous a mentionné dans « {{topic}} » - {{site_title}}","group_mentioned":"{{username}} vous a mentionné dans « {{topic}} » - {{site_title}}","quoted":"{{username}} vous a cité dans « {{topic}} » - {{site_title}}","replied":"{{username}} vous a répondu dans « {{topic}} » - {{site_title}}","posted":"{{username}} a posté dans « {{topic}} » - {{site_title}}","private_message":"{{username}} vous a envoyé un message direct dans « {{topic}} » - {{site_title}}","linked":"{{username}} a créé un lien vers votre message posté dans « {{topic}} » - {{site_title}}","watching_first_post":"{{username}} a crée un nouveau sujet « {{topic}} » - {{site_title}}","confirm_title":"Notifications activées - %{site_title}","confirm_body":"Les notifications ont été activées.","custom":"Notification de {{username}} sur %{site_title}"},"titles":{"mentioned":"mentionnés","replied":"nouvelle réponse","quoted":"cités","edited":"modifiés","liked":"nouveau j'aime","private_message":"nouveau message direct","invited_to_private_message":"invité au message privé","invitee_accepted":"invitation acceptée","posted":"nouveau message","moved_post":"message déplacé","linked":"linkés","granted_badge":"badge attribué","invited_to_topic":"invité à un sujet","group_mentioned":"groupe mentionné","group_message_summary":"nouveaux messages de groupe","watching_first_post":"nouveau sujet","topic_reminder":"rappel de sujet","liked_consolidated":"nouveaux j'aime","post_approved":"message approuvé","membership_request_consolidated":"nouvelles demandes d'adhésion"}},"upload_selector":{"title":"Ajouter une image","title_with_attachments":"Ajouter une image ou un fichier","from_my_computer":"Depuis mon appareil","from_the_web":"Depuis le Web","remote_tip":"lien vers l'image","remote_tip_with_attachments":"lien vers l'image ou le fichier {{authorized_extensions}}","local_tip":"sélectionnez des images depuis votre appareil","local_tip_with_attachments":"sélectionnez des images ou des fichiers depuis votre appareil {{authorized_extensions}}","hint":"(vous pouvez également faire un glisser-déposer dans l'éditeur pour les envoyer)","hint_for_supported_browsers":"vous pouvez aussi glisser-déposer ou coller des images dans l'éditeur","uploading":"En cours d'envoi","select_file":"Sélectionner un fichier","default_image_alt_text":"image"},"search":{"sort_by":"Trier par","relevance":"Pertinence","latest_post":"Dernier message","latest_topic":"Dernier sujet","most_viewed":"Plus vu","most_liked":"Plus aimé","select_all":"Sélectionner tout","clear_all":"Tout désélectionner","too_short":"Votre terme de recherche est trop court.","result_count":{"one":"\u003cspan\u003e%{count} résultat pour\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} résultats pour\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"rechercher des sujets, messages, utilisateurs ou catégories","full_page_title":"rechercher des sujets ou messages","no_results":"Aucun résultat.","no_more_results":"Aucun résultat supplémentaire.","searching":"Recherche en cours…","post_format":"#{{post_number}} par {{username}}","results_page":"Résultats de recherche pour « {{term}} »","more_results":"Il y a d'autres résultats. Merci de préciser vos critères de recherche.","cant_find":"Vous ne trouvez pas ce que vous cherchez ?","start_new_topic":"Voulez-vous commencer un nouveau sujet ?","or_search_google":"Ou essayez plutôt de chercher avec Google :","search_google":"Essayez plutôt de chercher avec Google :","search_google_button":"Google","search_google_title":"Rechercher dans ce site","context":{"user":"Chercher dans les messages de @{{username}}","category":"Rechercher dans la catégorie #{{category}}","tag":"Rechercher l'étiquette #{{tag}}","topic":"Rechercher dans ce sujet","private_messages":"Rechercher des messages directs"},"advanced":{"title":"Recherche avancée","posted_by":{"label":"Rédigé par"},"in_category":{"label":"Dans la catégorie"},"in_group":{"label":"Dans le groupe"},"with_badge":{"label":"Avec le badge"},"with_tags":{"label":"Etiquetté"},"filters":{"label":"Seulement retourner les sujets/messages...","title":"Seuls les titres correspondent","likes":"que j'ai aimé","posted":"auxquels j'ai participé","created":"J'ai créer","watching":"que je surveille","tracking":"que je suis","private":"qui sont dans mes messages directs","bookmarks":"auxquels j'ai mis un signet","first":"qui sont les premiers messages","pinned":"qui sont épinglés","unpinned":"qui ne sont pas épinglés","seen":"que j'ai lu","unseen":"je n'ai pas lu","wiki":"qui sont des wikis","images":"inclure le(s) images(s)","all_tags":"Contient toutes les étiquettes"},"statuses":{"label":"Dont les sujets","open":"sont ouverts","closed":"sont fermés","public":"sont publiques","archived":"sont archivés","noreplies":"n'ont aucune réponse","single_user":"contiennent un unique utilisateur"},"post":{"count":{"label":"Nombre minimum de messages"},"time":{"label":"Quand","before":"avant","after":"après"}}}},"hamburger_menu":"aller à une autre catégorie ou liste de sujets","new_item":"nouveau","go_back":"retour","not_logged_in_user":"page utilisateur avec un résumé de l'activité et les préférences ","current_user":"aller à votre page utilisateur","view_all":"Tout voir","topics":{"new_messages_marker":"dernière visite","bulk":{"select_all":"Tout sélectionner","clear_all":"Tout désélectionner","unlist_topics":"Ne plus lister les sujets","relist_topics":"Lister les sujets","reset_read":"Réinitialiser la lecture","delete":"Supprimer les sujets","dismiss":"Ignorer","dismiss_read":"Ignorer tous les sujets non lus","dismiss_button":"Ignorer…","dismiss_tooltip":"Ignorer les nouveaux messages ou arrêter de suivre les sujets","also_dismiss_topics":"Arrêter de suivre ces sujets pour qu'ils ne soient plus jamais marqués comme non lus","dismiss_new":"Ignorer les nouveaux","toggle":"basculer la sélection multiple de sujets","actions":"Actions sur la sélection","change_category":"Définir la catégorie","close_topics":"Fermer les sujets","archive_topics":"Archiver les sujets","notification_level":"Notifications","choose_new_category":"Choisissez la nouvelle catégorie pour les sujets :","selected":{"one":"Vous avez sélectionné \u003cb\u003e%{count}\u003c/b\u003e sujet.","other":"Vous avez sélectionné \u003cb\u003e{{count}}\u003c/b\u003e sujets."},"change_tags":"Changer les étiquettes","append_tags":"Ajouter les étiquettes","choose_new_tags":"Choisir les nouvelles étiquettes pour ces sujets :","choose_append_tags":"Choisissez de nouvelles étiquettes à ajouter à ces sujets :","changed_tags":"Les étiquettes de ces sujets ont été modifiées."},"none":{"unread":"Vous n'avez aucun sujet non lu.","new":"Vous n'avez aucun nouveau sujet.","read":"Vous n'avez lu aucun sujet pour le moment.","posted":"Vous n'avez écrit aucun message pour le moment.","latest":"Il n'y a aucun sujet pour le moment. C'est triste…","bookmarks":"Vous n'avez pas encore mis de signets à des sujets.","category":"Il n'y a pas de sujets dans {{category}}.","top":"Il n'y a pas de meilleurs sujets.","educate":{"new":"\u003cp\u003eVos nouveaux sujets apparaissent ici.\u003c/p\u003e\u003cp\u003ePar défaut, les sujets sont considérés comme nouveaux et affichent l'indicateur \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enouveau\u003c/span\u003e lorsqu'ils ont été créés depuis moins de 2 jours.\u003c/p\u003e\u003cp\u003eVous pouvez modifier cela dans vos \u003ca href=\"%{userPrefsUrl}\"\u003epréférences\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eVos sujets non lus apparaissent ici.\u003c/p\u003e\u003cp\u003ePar défaut, les sujets considérés comme non lus et qui affichent le nombre de messages non lus \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e sont ceux :\u003c/p\u003e \u003cul\u003e\u003cli\u003eque vous avez créés\u003c/li\u003e\u003cli\u003eauxquels vous avez répondus\u003c/li\u003e\u003cli\u003eque vous avez lus plus de 4 minutes\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eou que vous avez explicitement suivis ou surveillés.\u003c/p\u003e\u003cp\u003eVous pouvez modifier cela dans vos \u003ca href=\"%{userPrefsUrl}\"\u003epréférences\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Il n'y a plus de sujets à lire.","posted":"Il n'y a plus de sujets à lire.","read":"Il n'y a plus de sujets à lire.","new":"Il n'y a plus de nouveaux sujets.","unread":"Il n'y a plus de sujets à lire.","category":"Il n'y a plus de sujets à lire dans {{category}}.","top":"Il n'y a plus de meilleurs sujets.","bookmarks":"Il n'y a plus de sujets avec des signets."}},"topic":{"filter_to":{"one":"%{count} message dans le sujet","other":"{{count}} messages dans le sujet"},"create":"Créer un sujet","create_long":"Créer un nouveau sujet","open_draft":"Ouvrir ébauche","private_message":"Écrire un message","archive_message":{"help":"Déplacer le message dans votre archive","title":"Archiver"},"move_to_inbox":{"title":"Déplacer dans la boîte de réception","help":"Redéplacer dans la boîte de réception"},"edit_message":{"help":"Modifier premier message","title":"Modifier message"},"defer":{"help":"Marquer comme non-lu","title":"Reporter"},"feature_on_profile":{"help":"Ajouter un lien vers ce sujet sur votre carte d\u0026#39;utilisateur et votre profil","title":"Mettre en avant sur le profil"},"remove_from_profile":{"warning":"Votre profil a déjà un sujet en vedette. Si vous continuez, ce sujet le remplacera.","help":"Retirer le lien vers ce sujet de votre profil d'usager","title":"Retirer du profil"},"list":"Sujets","new":"nouveau sujet","unread":"non lus","new_topics":{"one":"%{count} nouveau sujet","other":"{{count}} nouveaux sujets"},"unread_topics":{"one":"%{count} sujet non lu","other":"{{count}} sujets non lus"},"title":"Sujet","invalid_access":{"title":"Ce sujet est privé","description":"Désolé, vous n'avez pas accès à ce sujet !","login_required":"Vous devez vous connecter pour voir ce sujet de discussion."},"server_error":{"title":"Sujet impossible à charger","description":"Désolé, nous n'avons pu charger ce sujet, probablement du à un problème de connexion. Merci de réessayer à nouveau. Si le problème persiste, merci de nous le faire savoir."},"not_found":{"title":"Sujet non trouvé","description":"Désolé, nous n'avons pas trouvé ce sujet. Peut-être a t-il été retiré par un modérateur ?"},"total_unread_posts":{"one":"vous avez %{count} message non lu dans ce sujet","other":"vous avez {{count}} messages non lus dans ce sujet"},"unread_posts":{"one":"vous avez %{count} message non lu sur ce sujet","other":"vous avez {{count}} messages non lus sur ce sujet"},"new_posts":{"one":"il y a %{count} nouveau message sur ce sujet depuis votre derniere lecture","other":"il y a {{count}} nouveaux messages sur ce sujet depuis votre derniere lecture"},"likes":{"one":"%{count} personne a aimé ce sujet","other":"{{count}} personnes ont aimé ce sujet"},"back_to_list":"Retour à la liste des sujets","options":"Options du sujet","show_links":"afficher les liens dans ce sujet","toggle_information":"basculer affichage des détails de ce sujet","read_more_in_category":"Vous voulez en lire plus ? Découvrez d'autres sujets dans {{catLink}} ou {{latestLink}}.","read_more":"Vous voulez en lire plus ? {{catLink}} ou {{latestLink}}.","group_request":"Effectuez une demande d'adhésion au groupe `{{name}}` pour afficher ce sujet.","group_join":"Vous devez rejoindre le groupe `{{name}}` pour voir ce sujet","group_request_sent":"Votre demande d'adhésion au groupe a été envoyée. Vous serez averti de son acceptation.","unread_indicator":"Aucun membre n'a encore lu le dernier message de ce topic.","browse_all_categories":"Voir toutes les catégories","view_latest_topics":"voir les derniers sujets","suggest_create_topic":"Pourquoi ne pas créer un sujet ?","jump_reply_up":"aller à des réponses précédentes","jump_reply_down":"allez à des réponses ultérieures","deleted":"Ce sujet a été supprimé","topic_status_update":{"title":"Action planifiée du sujet","save":"Planifier","num_of_hours":"Nombre d'heures :","remove":"Supprimer la planification","publish_to":"Publier dans :","when":"Quand :","public_timer_types":"Actions planifiées du sujet","private_timer_types":"Actions utilisateur planifiées du sujet","time_frame_required":"Veuillez sélectionner un intervalle de temps"},"auto_update_input":{"none":"Sélectionner un intervalle de temps","later_today":"Plus tard aujourd'hui","tomorrow":"Demain","later_this_week":"Plus tard cette semaine","this_weekend":"Ce weekend","next_week":"Semaine prochaine","two_weeks":"Deux semaines","next_month":"Mois prochai","two_months":"Deux mois","three_months":"Trois mois","four_months":"Quatre mois","six_months":"Six mois","one_year":"Une année","forever":"Toujours","pick_date_and_time":"Sélectionner une date et heure","set_based_on_last_post":"Fermer par rapport au dernier message"},"publish_to_category":{"title":"Planifier publication"},"temp_open":{"title":"Ouvrir temporairement"},"auto_reopen":{"title":"Ouvrir automatiquement le sujet"},"temp_close":{"title":"Fermer temporairement"},"auto_close":{"title":"Fermer automatiquement le sujet","label":"Heures de fermeture automatique du sujet :","error":"Veuillez entrer une valeur valide.","based_on_last_post":"Ne pas fermer tant que le dernier message du sujet n'a pas atteint cette ancienneté."},"auto_delete":{"title":"Auto-suppression du sujet"},"auto_bump":{"title":"Remonter automatiquement le sujet"},"reminder":{"title":"Me rappeler"},"status_update_notice":{"auto_open":"Ce sujet sera automatiquement ouvert %{timeLeft}.","auto_close":"Ce sujet sera automatiquement fermé %{timeLeft}.","auto_publish_to_category":"Ce sujet sera publié dans \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"Ce sujet sera fermé %{duration} après la dernière réponse.","auto_delete":"Ce sujet sera automatiquement supprimé %{timeLeft}.","auto_bump":"Ce sujet sera automatiquement remonté %{timeLeft}.","auto_reminder":"Vous serez rappelé sur ce sujet %{timeLeft}."},"auto_close_title":"Paramètres de fermeture automatique","auto_close_immediate":{"one":"Le dernier message dans ce sujet est déjà vieux de %{count} heure donc le sujet sera immédiatement fermé.","other":"Le dernier message dans ce sujet est déjà vieux de %{count} heures donc le sujet sera immédiatement fermé."},"timeline":{"back":"Retour","back_description":"Revenir au dernier message non lu","replies_short":"%{current} / %{total}"},"progress":{"title":"progression dans le sujet","go_top":"haut","go_bottom":"bas","go":"aller","jump_bottom":"aller au dernier message","jump_prompt":"aller à…","jump_prompt_of":"de %{count} messages","jump_prompt_long":"Aller à…","jump_bottom_with_number":"aller au message %{post_number}","jump_prompt_to_date":"à la date","jump_prompt_or":"ou","total":"total de messages","current":"message actuel"},"notifications":{"title":"modifier la fréquence des notifications concernant ce sujet","reasons":{"mailing_list_mode":"Vous avez activé la liste de diffusion, vous serez donc notifié des réponses à ce sujet par courriel.","3_10":"Vous recevrez des notifications car vous surveillez une étiquette de ce sujet.","3_6":"Vous recevrez des notifications parce que vous surveillez cette catégorie.","3_5":"Vous recevrez des notifications parce que vous avez commencé à surveiller ce sujet automatiquement.","3_2":"Vous recevrez des notifications car vous surveillez ce sujet.","3_1":"Vous recevrez des notifications car vous avez créé ce sujet.","3":"Vous recevrez des notifications car vous surveillez ce sujet.","2_8":"Vous verrez un compteur de nouvelles réponses car vous suivez cette catégorie.","2_4":"Vous verrez un compteur de nouvelles réponses car vous avez répondu dans ce sujet.","2_2":"Vous verrez un compteur de nouvelles réponses car vous suivez ce sujet.","2":"Vous verrez un compteur de nouvelles réponses car vous \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eavez lu ce sujet\u003c/a\u003e.","1_2":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond.","1":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond.","0_7":"Vous ignorez toutes les notifications de cette catégorie.","0_2":"Vous ignorez toutes les notifications de ce sujet.","0":"Vous ignorez toutes les notifications de ce sujet."},"watching_pm":{"title":"Surveiller","description":"Vous serez notifié de chaque nouvelle réponse dans ce message, et le nombre de nouvelles réponses apparaîtra."},"watching":{"title":"Surveiller","description":"Vous serez notifié de chaque nouvelle réponse dans ce sujet, et le nombre de nouvelles réponses apparaîtra."},"tracking_pm":{"title":"Suivi","description":"Le nombre de nouvelles réponses apparaîtra pour ce message. Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"tracking":{"title":"Suivi","description":"Le nombre de nouvelles réponses apparaîtra pour ce sujet. Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"regular":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"regular_pm":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"muted_pm":{"title":"Silencieux","description":"Vous ne serez jamais averti de quoi que ce soit à propos de ce message."},"muted":{"title":"Silencieux","description":"Vous ne serez jamais notifié de rien concernant ce sujet, et il n'apparaîtra pas des les derniers sujets."}},"actions":{"title":"Actions","recover":"Annuler la suppression du sujet","delete":"Supprimer le sujet","open":"Ouvrir le sujet","close":"Fermer le sujet","multi_select":"Sélectionner les messages…","timed_update":"Planifier une action…","pin":"Épingler le sujet…","unpin":"Désépingler le sujet…","unarchive":"Désarchiver le sujet","archive":"Archiver le sujet","invisible":"Rendre invisible","visible":"Rendre visible","reset_read":"Réinitialiser les données de lecture","make_public":"Rendre le sujet public","make_private":"Transformer en message direct","reset_bump_date":"Réinitialiser la date d'actualisation"},"feature":{"pin":"Épingler le sujet","unpin":"Désépingler le sujet","pin_globally":"Épingler le sujet globalement","make_banner":"Sujet à la une","remove_banner":"Retirer le sujet à la une"},"reply":{"title":"Répondre","help":"commencez à répondre à ce sujet"},"clear_pin":{"title":"Désépingler","help":"Retirer l'épingle de ce sujet afin qu'il n'apparaisse plus en tête de votre liste de sujet"},"share":{"title":"Partager","extended_title":"Partager ce lien","help":"partager ce sujet"},"print":{"title":"Imprimer","help":"Ouvrir une version de ce sujet adaptée à l'impression"},"flag_topic":{"title":"Signaler","help":"signaler secrètement ce sujet pour attirer l'attention ou envoyer une notification privée à son propos.","success_message":"Vous avez signalé ce sujet avec succès."},"make_public":{"title":"Convertir en sujet public","choose_category":"Veuillez choisir une catégorie pour le sujet public :"},"feature_topic":{"title":"Mettre ce sujet en évidence","pin":"Faire apparaître ce sujet en haut de la catégorie {{categoryLink}} jusqu'à","confirm_pin":"Vous avez déjà {{count}} sujets épinglés. Trop de sujets épinglés peut être lourd pour les nouveaux utilisateurs et les visiteurs. Êtes-vous sûr de vouloir épingler un autre sujet dans cette catégorie ?","unpin":"Enlever ce sujet du haut de la catégorie {{categoryLink}}.","unpin_until":"Enlever ce sujet du haut de la catégorie {{categoryLink}} ou attendre jusqu'à \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Les utilisateurs peuvent désépingler le sujet pour eux.","pin_validation":"Une date est requise pour épingler ce sujet.","not_pinned":"Il n'y a aucun sujet épinglé dans {{categoryLink}}.","already_pinned":{"one":"Sujets actuellement épinglés dans {{categoryLink}} : \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Sujets actuellement épinglés dans {{categoryLink}} : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Faire apparaître ce sujet en haut de toutes les listes de sujet jusqu'à ","confirm_pin_globally":"Vous avez déjà {{count}} sujets épinglés. Trop de sujets épinglés peut être lourd pour les nouveaux utilisateurs et les visiteurs. Êtes-vous sûr de vouloir épingler globalement un autre sujet ?","unpin_globally":"Enlever ce sujet du haut de toutes les listes de sujets.","unpin_globally_until":"Enlever ce sujet du haut de toutes les listes de sujet ou attendre jusqu'à \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Les utilisateurs peuvent désépingler le sujet pour eux.","not_pinned_globally":"Il n'y a aucun sujet épinglé globalement.","already_pinned_globally":{"one":"Sujets actuellement épinglés globalement : \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Sujets actuellement épinglés globalement : \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Mettre ce sujet à la une, il apparaîtra en haut de chaque page.","remove_banner":"Enlever le sujet à la une qui apparaît en haut de chaque page.","banner_note":"Les utilisateurs peuvent ignorer le sujet à la une. Seul un sujet peut être mis à la une à la fois.","no_banner_exists":"Il n'y a pas de sujet à la une.","banner_exists":"Il y \u003cstrong class='badge badge-notification unread'\u003ea\u003c/strong\u003e un sujet à la une."},"inviting":"Invitation en cours…","automatically_add_to_groups":"Cette invitation inclut également l'accès aux groupes suivants :","invite_private":{"title":"Inviter dans la discussion","email_or_username":"Adresse de courriel ou @pseudo de l'invité","email_or_username_placeholder":"adresse de courriel ou @pseudo","action":"Inviter","success":"Nous avons invité cet utilisateur à participer à cette discussion.","success_group":"Nous avons invité ce groupe à participer à cette discussion.","error":"Désolé, il y a eu une erreur lors de l'invitation de cet utilisateur.","group_name":"nom du groupe"},"controls":"Actions sur le sujet","invite_reply":{"title":"Inviter","username_placeholder":"pseudo","action":"Envoyer une invitation","help":"inviter d'autres personnes sur ce sujet par email ou notifications","to_forum":"Nous allons envoyer un courriel à votre ami pour lui permettre de participer au forum juste en cliquant sur un lien, sans avoir à saisir un identifiant.","sso_enabled":"Entrez le nom d'utilisateur de la personne que vous souhaitez inviter sur ce sujet.","to_topic_blank":"Entrez le pseudo ou l'adresse email de la personne que vous souhaitez inviter sur ce sujet.","to_topic_email":"Vous avez entré une adresse email. Nous allons envoyer une invitation à votre ami lui permettant de répondre immédiatement à ce sujet.","to_topic_username":"Vous avez entré un nom d'utilisateur. Nous allons envoyer une notification avec un lien les invitant sur ce sujet.","to_username":"Entrez le nom d'utilisateur de la personne que vous souhaitez inviter. Nous enverrons une notification avec un lien les invitant sur ce sujet.","email_placeholder":"nom@exemple.com","success_email":"Nous avons envoyé une invitation à \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Nous vous avertirons lorsqu'il l'aura acceptée. Suivez l'état de vos invitations dans l'onglet prévu à cet effet sur votre page utilisateur.","success_username":"Nous avons invité cet utilisateur à participer à ce sujet.","error":"Désolé, nous n'avons pas pu inviter cette personne. Elle a peut-être déjà été invitée ? (Le nombre d'invitations est limité)","success_existing_email":"Un utilisateur avec le courriel \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e existe déjà. Nous avons invité cet utilisateur à participer à ce sujet."},"login_reply":"Se connecter pour répondre","filters":{"n_posts":{"one":"%{count} message","other":"{{count}} messages"},"cancel":"Supprimer le filtre"},"move_to":{"title":"Déplacer vers","action":"déplacer vers","error":"Il y a eu une erreur en déplaçant les messages."},"split_topic":{"title":"Déplacer vers un nouveau sujet","action":"déplacer vers un nouveau sujet","topic_name":"Titre du nouveau sujet","radio_label":"Nouveau sujet","error":"Il y a eu une erreur en déplaçant les messages vers un nouveau sujet.","instructions":{"one":"Vous êtes sur le point de créer un nouveau sujet avec le message que vous avez sélectionné.","other":"Vous êtes sur le point de créer un nouveau sujet avec les \u003cb\u003e{{count}}\u003c/b\u003e messages que vous avez sélectionné."}},"merge_topic":{"title":"Déplacer vers un sujet existant","action":"déplacer vers un sujet existant","error":"Il y a eu une erreur en déplaçant les messages dans ce sujet.","radio_label":"Sujet existant","instructions":{"one":"Merci de sélectionner le sujet dans lequel vous souhaitez déplacer ce message.","other":"Merci de sélectionner le sujet dans lequel vous souhaitez déplacer ces \u003cb\u003e{{count}}\u003c/b\u003e messages."}},"move_to_new_message":{"title":"Déplacer vers un nouveau message","action":"déplacer vers un nouveau message","message_title":"Titre du nouveau message","radio_label":"Nouveau message","participants":"Participants","instructions":{"one":"Vous êtes sur le point de créer un nouveau message avec le message que vous avez sélectionné.","other":"Vous êtes sur le point de créer un nouveau message avec les \u003cb\u003e{{count}}\u003c/b\u003e messages que vous avez sélectionné."}},"move_to_existing_message":{"title":"Déplacer vers un message existant","action":"déplacer vers un message existant","radio_label":"Message existant","participants":"Participants","instructions":{"one":"Merci de sélectionner le message dans lequel vous souhaitez déplacer ce message.","other":"Merci de sélectionner le message dans lequel vous souhaitez déplacer ces \u003cb\u003e{{count}}\u003c/b\u003e messages."}},"merge_posts":{"title":"Fusionner les messages sélectionnés","action":"fusionner les messages sélectionnés","error":"Il y a eu une erreur lors de la fusion des messages sélectionnés."},"change_owner":{"title":"Changer de propriétaire","action":"modifier l'auteur","error":"Il y a eu une erreur lors du changement de l'auteur des messages.","placeholder":"pseudo du nouvel auteur","instructions":{"one":"Merci d'indiquer un nouvel auteur pour le message de \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Merci d'indiquer un nouvel auteur pour {{count}} messages par \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Modifier la date/heure…","action":"modifier la date/heure","invalid_timestamp":"La date/heure ne peut être dans le futur","error":"Il y a eu une erreur lors de la modification de la date/heure de ce sujet.","instructions":"Veuillez sélectionner la nouvelle date/heure du sujet. Les messages dans ce topic seront mis à jour pour maintenir la même différence d'heure."},"multi_select":{"select":"sélectionner","selected":"sélectionnés ({{count}})","select_post":{"label":"sélectionner","title":"Ajouter le message à la sélection"},"selected_post":{"label":"sélectionné","title":"Cliquer pour retirer le message de la sélection"},"select_replies":{"label":"sélectionner avec réponses","title":"Ajouter le message et toutes ses réponses à la sélection"},"select_below":{"label":"sélectionner avec suivants","title":"Ajouter un message et tout ceux qui suivent à la sélection"},"delete":"supprimer la sélection","cancel":"annuler la sélection","select_all":"tout sélectionner","deselect_all":"tout désélectionner","description":{"one":"vous avez sélectionné \u003cb\u003e%{count}\u003c/b\u003e message.","other":"Vous avez sélectionné \u003cb\u003e{{count}}\u003c/b\u003e messages."}},"deleted_by_author":{"one":"(sujet supprimé par son auteur, sera supprimé automatiquement dans %{count} heure à moins qu'il ne soit signalé)","other":"(sujet supprimé par son auteur, sera supprimé automatiquement dans %{count} heures à moins qu'il ne soit signalé)"}},"post":{"quote_reply":"Citer","edit_reason":"Raison :","post_number":"message {{number}}","ignored":"Contenu ignoré","wiki_last_edited_on":"Wiki édité pour la dernière fois","last_edited_on":"message édité pour la dernière fois","reply_as_new_topic":"Répondre par un nouveau sujet","reply_as_new_private_message":"Répondre par un nouveau message direct adressé aux mêmes destinataires","continue_discussion":"Suite du sujet {{postLink}} :","follow_quote":"aller au message cité","show_full":"Afficher le message complet","show_hidden":"Visualiser contenu ignoré.","deleted_by_author":{"one":"(message supprimé par son auteur, sera supprimé automatiquement dans %{count} heure à moins qu'il ne soit signalé)","other":"(message supprimé par son auteur, sera supprimé automatiquement dans %{count} heures à moins qu'il ne soit signalé)"},"collapse":"réduire","expand_collapse":"étendre/réduire","locked":"un responsable a vérouillé ce message pour empêcher la modification","gap":{"one":"voir %{count} réponse cachée","other":"voir {{count}} réponses cachées"},"notice":{"new_user":"C'est la première fois que {{user}} publie un message — accueillons-le comme il se doit dans notre communauté !","returning_user":"Cela faisait un moment que nous n'avions pas vu {{user}} — son dernier message remonte à {{time}}."},"unread":"Ce message est non lu","has_replies":{"one":"{{count}} réponse","other":"{{count}} réponses"},"has_likes_title":{"one":"%{count} personne a aimé ce message","other":"{{count}} personnes ont aimé ce message"},"has_likes_title_only_you":"vous avez aimé ce message","has_likes_title_you":{"one":"vous et %{count} autre personne ont aimé ce message","other":"vous et {{count}} autres personnes ont aimé ce message"},"errors":{"create":"Désolé, il y a eu une erreur lors de la publication de votre message. Merci de réessayer.","edit":"Désolé, il y a eu une erreur lors de la modification de votre message. Merci de réessayer.","upload":"Désolé, il y a eu une erreur lors de l'envoi du fichier. Merci de réessayer.","file_too_large":"Désolé, ce fichier est trop volumineux (la taille maximale autorisée est de {{max_size_kb}} Ko). Pourquoi ne téléchargez-vous pas votre gros fichier sur un service d'hébergement externe, pour ensuite coller le lien ici ?","too_many_uploads":"Désolé, vous ne pouvez envoyer qu'un seul fichier à la fois.","too_many_dragged_and_dropped_files":"Désolé, vous ne pouvez télécharger que {{max}} fichiers à la fois.","upload_not_authorized":"Désolé, le fichier que vous essayez d'envoyer n'est pas autorisé (extensions autorisées : {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"Désolé, les nouveaux utilisateurs ne peuvent pas envoyer d'images.","attachment_upload_not_allowed_for_new_user":"Désolé, les nouveaux utilisateurs ne peuvent pas envoyer de fichier.","attachment_download_requires_login":"Désolé, vous devez être connecté pour télécharger une pièce jointe."},"abandon_edit":{"confirm":"Êtes-vous sûr de vouloir annuler vos changements ?","no_value":"Non, garder","no_save_draft":"Non, enregistrer le brouillon","yes_value":"Oui, annuler la modification"},"abandon":{"confirm":"Êtes-vous sûr de vouloir abandonner votre message ?","no_value":"Non, le conserver","no_save_draft":"Non, enregistrer le brouillon","yes_value":"Oui, abandonner"},"via_email":"ce message est arrivé par courriel","via_auto_generated_email":"ce message est arrivé via un courriel généré automatiquement","whisper":"ce message est un murmure privé pour les modérateurs","wiki":{"about":"ce message est un wiki"},"archetypes":{"save":"Sauvegarder les options"},"few_likes_left":"Merci de partager votre amour ! Vous n'avez plus que quelques J'aime à distribuer pour aujourd'hui.","controls":{"reply":"commencez à répondre à ce message","like":"J'aime ce message","has_liked":"vous avez aimé ce message","read_indicator":"Membres ayant lu cette publication","undo_like":"annuler le J'aime","edit":"modifier ce message","edit_action":"Modifier","edit_anonymous":"Désolé, mais vous devez être connecté pour modifier ce message.","flag":"signaler secrètement ce message pour attirer l'attention ou envoyer une notification privée à son sujet","delete":"supprimer ce message","undelete":"annuler la suppression de ce message","share":"partager ce message","more":"Plus","delete_replies":{"confirm":"Voulez-vous aussi supprimer les réponses à ce message ?","direct_replies":{"one":"Oui et %{count} réponse directe","other":"Oui et {{count}} réponses directes"},"all_replies":{"one":"Oui et la réponse","other":"Oui et les {{count}} réponses"},"just_the_post":"Non, uniquement ce message"},"admin":"actions d'administration sur le message","wiki":"Basculer en mode Wiki","unwiki":"Retirer le mode Wiki","convert_to_moderator":"Ajouter la couleur modérateur","revert_to_regular":"Retirer la couleur modérateur","rebake":"Reconstruire l'HTML","unhide":"Ré-afficher","change_owner":"Modifier l'auteur","grant_badge":"Décerner le badge","lock_post":"Vérouiller message","lock_post_description":"empêcher l'utilisateur de modifier le message","unlock_post":"Déverrouiller message","unlock_post_description":"permettre l'utilisateur de modifier le message","delete_topic_disallowed_modal":"Vous n'avez pas le permission de supprimer ce sujet. Si vous souhaitez vraiment le voir supprimé, signalez-le aux modérateurs avec une explication.","delete_topic_disallowed":"vous n'avez pas la permission de supprimer ce sujet","delete_topic":"supprimer le sujet","add_post_notice":"Ajouter note pour responsables","remove_post_notice":"Retirer le note pour responsables","remove_timer":"retirer le compteur"},"actions":{"flag":"Signaler","defer_flags":{"one":"Ignorer le signalement","other":"Ignorer les signalements"},"undo":{"off_topic":"Annuler le signalement","spam":"Annuler le signalement","inappropriate":"Annuler le signalement","bookmark":"Retirer le signet","like":"Annuler le J'aime"},"people":{"off_topic":"signalé comme hors-sujet","spam":"signalé comme spam","inappropriate":"signalé comme inapproprié","notify_moderators":"signalé aux modérateurs","notify_user":"a envoyé un message","bookmark":"signet ajouté","like":{"one":"a aimé ceci","other":"ont aimé ceci"},"read":{"one":"a lu ceci","other":"ont lu ceci"},"like_capped":{"one":"et {{count}} autre a aimé ça","other":"et {{count}} autres ont aimé ça"},"read_capped":{"one":"et {{count}} autre a lu ceci","other":"et {{count}} autres ont lu ceci"}},"by_you":{"off_topic":"Vous l'avez signalé comme étant hors-sujet","spam":"Vous l'avez signalé comme étant du spam","inappropriate":"Vous l'avez signalé comme étant inapproprié","notify_moderators":"Vous l'avez signalé pour modération","notify_user":"Vous avez envoyé un message à cet utilisateur","bookmark":"Vous avez mis un signet à ce message","like":"Vous l'avez aimé"}},"delete":{"confirm":{"one":"Êtes-vous sûr de vouloir supprimer ce message ?","other":"Êtes-vous sûr de vouloir supprimer ces {{count}} messages ?"}},"merge":{"confirm":{"one":"Êtes-vous sûr de vouloir fusionner ces messages ?","other":"Êtes-vous sûr de vouloir fusionner ces {{count}} messages ?"}},"revisions":{"controls":{"first":"Première révision","previous":"Révision précédente","next":"Révision suivante","last":"Dernière révision","hide":"Masquer la révision","show":"Afficher la révision","revert":"Revenir à cette révision","edit_wiki":"Modifier le wiki","edit_post":"Modifier le message","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}}\u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Afficher le rendu avec les ajouts et les retraits en ligne","button":"HTML"},"side_by_side":{"title":"Afficher les différences de rendu côte-à-côte","button":"HTML"},"side_by_side_markdown":{"title":"Afficher les différences de la source côte-à-côte","button":"Brut"}}},"raw_email":{"displays":{"raw":{"title":"Afficher le courriel brut","button":"Brut"},"text_part":{"title":"Afficher le contenu texte du courriel","button":"Texte"},"html_part":{"title":"Afficher le contenu HTML du courriel","button":"HTML"}}},"bookmarks":{"create":"Ajouter un signet","created":"Créé","name":"Nom","actions":{"delete_bookmark":{"name":"Supprimer le signet"}}}},"category":{"can":"peut\u0026hellip; ","none":"(aucune catégorie)","all":"Toutes les catégories","choose":"catégorie\u0026hellip;","edit":"Modifier","edit_dialog_title":"Modifier : %{categoryName}","view":"Voir les sujets dans la catégorie","general":"Général","settings":"Paramètres","topic_template":"Modèle de sujet","tags":"Étiquettes","tags_allowed_tags":"Réserver l'utilisation de ces étiquettes à cette catégorie :","tags_allowed_tag_groups":"Réserver l'utilisation de ces groupes d'étiquettes à cette catégorie :","tags_placeholder":"(Facultatif) liste des étiquettes autorisées","tags_tab_description":"Les étiquettes et les groupes d'étiquettes spécifiés au dessus ne seront disponibles que dans cette catégorie ainsi que dans toutes les catégories qui contiennent les mêmes spécifications. Ces étiquettes ne pourront pas être utilisées dans d'autres catégories.","tag_groups_placeholder":"(Facultatif) liste des groupes de étiquettes autorisées","manage_tag_groups_link":"Gérer les groupes d'étiquettes ici.","allow_global_tags_label":"Permettre aussi d'autres étiquettes","tag_group_selector_placeholder":"(Facultatif) Groupe d'étiquettes","required_tag_group_description":"Exiger que les nouveaux sujets aient des étiquette à partir d'un groupe d’étiquettes :","min_tags_from_required_group_label":"Nombre d'étiquettes :","required_tag_group_label":"Groupe d'étiquettes :","topic_featured_link_allowed":"Autoriser les liens à la une dans cette catégorie","delete":"Supprimer la catégorie","create":"Nouvelle catégorie","create_long":"Créer une nouvelle catégorie","save":"Enregistrer la catégorie","slug":"Identifiant de la catégorie","slug_placeholder":"(Facultatif) mots séparés par des tirets pour l'URL","creation_error":"Il y a eu une erreur lors de la création de la catégorie.","save_error":"Il y a eu une erreur lors de la sauvegarde de la catégorie.","name":"Nom de la catégorie","description":"Description","topic":"catégorie du sujet","logo":"Logo de la catégorie","background_image":"Image de fond de la catégorie","badge_colors":"Couleurs du badge","background_color":"Couleur du fond","foreground_color":"Couleur du texte","name_placeholder":"Un ou deux mots maximum","color_placeholder":"N'importe quelle couleur","delete_confirm":"Êtes-vous sûr de vouloir supprimer cette catégorie ?","delete_error":"Il y a eu une erreur lors de la suppression.","list":"Lister les catégories","no_description":"Veuillez ajouter une description pour cette catégorie.","change_in_category_topic":"Modifier la description","already_used":"Cette couleur est déjà utilisée par une autre catégorie","security":"Sécurité","special_warning":"Avertissement : cette catégorie est une catégorie pré-remplie et les réglages de sécurité ne peuvent pas être modifiés. Si vous ne souhaitez pas utiliser cette catégorie, supprimez là au lieu de détourner sa fonction.","uncategorized_security_warning":"Cette catégorie est spéciale. Elle sert de zone d'attente pour les sujets qui n'ont pas de catégorie ; vous ne pouvez pas changer ses paramètres de sécurité.","uncategorized_general_warning":"Cette catégorie est spéciale. Elle sert de catégorie par défaut pour les nouveaux sujets qui ne sont pas liés à une catégorie. Si vous souhaitez changer cela et forcer la sélection de catégorie, \u003ca href=\"%{settingLink}\"\u003eveuillez désactiver ce paramètre\u003c/a\u003e. Si vous voulez modifier son nom ou sa description, allez dans \u003ca href=\"%{customizeLink}\"\u003ePersonnaliser / Contenu\u003c/a\u003e.","pending_permission_change_alert":"Vous n'avez pas ajouté %{group} à cette catégorie; cliquez sur ce bouton pour les ajouter.","images":"Images","email_in":"Adresse de courriel entrant personnalisée :","email_in_allow_strangers":"Accepter les courriels d'utilisateurs anonymes sans compte","email_in_disabled":"La possibilité de créer des nouveaux sujets via courriel est désactivé dans les Paramètres. Pour l'activer,","email_in_disabled_click":"activer le paramètre « email in ».","mailinglist_mirror":"La catégorie reflète une liste de diffusion","show_subcategory_list":"Afficher la liste des sous-catégories au dessus des sujets dans cette catégorie.","num_featured_topics":"Nombre de sujets affichés sur la page des catégories :","subcategory_num_featured_topics":"Nombre de sujets à la une sur la page de la catégorie parente :","all_topics_wiki":"Faire des nouveaux sujets des Wikis par défaut","subcategory_list_style":"Style des listes de sous-catégories :","sort_order":"Trier la liste de sujets par :","default_view":"Liste de sujets par défaut :","default_top_period":"Période des meilleurs sujets par défaut :","allow_badges_label":"Autoriser les badges à être accordé dans cette catégorie","edit_permissions":"Modifier les permissions","reviewable_by_group":"En plus des responsables, les messages et signalements dans cette catégorie peuvent aussi être vérifier par :","review_group_name":"nom du groupe","require_topic_approval":"Nécessiter l'approbation pour chaque nouveau sujet","require_reply_approval":"Nécessiter l'approbation pour chaque nouvelle réponse","this_year":"cette année","position":"Position sur la page des catégories :","default_position":"Position par défaut","position_disabled":"Les catégories seront affichées dans l'ordre d'activité. Pour contrôler l'ordre des catégories dans la liste,","position_disabled_click":"activer le paramètre \"fixed category positions\"","minimum_required_tags":"Nombre minimum d'étiquettes requises dans un sujet :","parent":"Catégorie parente","num_auto_bump_daily":"Nombre de sujets ouverts à remonter dans la liste automatiquement et quotidiennement :","navigate_to_first_post_after_read":"Naviguer vers le premier message après que les sujets sont lus","notifications":{"watching":{"title":"Surveiller","description":"Vous surveillerez automatiquement tous les sujets dans ces catégories. Vous serez notifié des nouveaux messages dans tous les sujets, et le nombre de nouvelles réponses sera affiché."},"watching_first_post":{"title":"Surveiller les nouveaux sujets","description":"Vous serez averti de nouveaux sujets dans cette catégorie mais pas de réponses aux sujets."},"tracking":{"title":"Suivi","description":"Vous allez suivre automatiquement tous les sujets dans ces catégories. Vous serez notifié lorsque quelqu'un mentionne votre @pseudo ou vous répond, et le nombre de nouvelles réponses sera affiché."},"regular":{"title":"Normal","description":"Vous serez notifié si quelqu'un mentionne votre @pseudo ou vous répond."},"muted":{"title":"Silencieux","description":"Vous ne serez jamais notifié de rien concernant les nouveaux sujets dans ces catégories, et elles n'apparaîtront pas dans les dernières catégories."}},"search_priority":{"label":"Priorité de recherche","options":{"normal":"Normal","ignore":"Ignorer","very_low":"Très faible","low":"Faible","high":"Fort","very_high":"Très fort"}},"sort_options":{"default":"standard","likes":"J'aime","op_likes":"J'aime du premier message","views":"Vues","posts":"Messages","activity":"Activité","posters":"Auteurs","category":"Catégorie","created":"Création","votes":"Votes"},"sort_ascending":"Croissant","sort_descending":"Décroissant","subcategory_list_styles":{"rows":"Rangées","rows_with_featured_topics":"Rangées avec sujets à la une","boxes":"Boîtes","boxes_with_featured_topics":"Boîtes avec sujets à la une"},"settings_sections":{"general":"Général","moderation":"Modération","appearance":"Apparence","email":"Courriel"}},"flagging":{"title":"Merci d'aider à garder notre communauté civilisée !","action":"Signaler ce message","take_action":"Intervenir","notify_action":"Message","official_warning":"Avertissement officiel","delete_spammer":"Supprimer le spammeur","yes_delete_spammer":"Oui, supprimer le spammeur","ip_address_missing":"(N/A)","hidden_email_address":"(masqué)","submit_tooltip":"Soumettre le signalement privé","take_action_tooltip":"Atteindre le seuil de signalement immédiatement, plutôt que d'attendre plus de signalement de la communauté.","cant":"Désolé, vous ne pouvez pas signaler ce message pour le moment","notify_staff":"Notifier les responsables de manière privée","formatted_name":{"off_topic":"C'est hors-sujet","inappropriate":"C'est inapproprié","spam":"C'est du spam"},"custom_placeholder_notify_user":"Soyez précis, constructif, et toujours respectueux.","custom_placeholder_notify_moderators":"Dites-nous ce qui vous dérange spécifiquement, et fournissez des liens pertinents et exemples si possible.","custom_message":{"at_least":{"one":"saisir au moins %{count} caractère","other":"saisir au moins {{count}} caractères"},"more":{"one":"%{count} restant…","other":"{{count}} restants…"},"left":{"one":"%{count} restant","other":"{{count}} restants"}}},"flagging_topic":{"title":"Merci de nous aider à garder notre communauté civilisé !","action":"Signaler le sujet","notify_action":"Message"},"topic_map":{"title":"Résumé du sujet","participants_title":"Auteurs fréquents","links_title":"Liens populaires","links_shown":"afficher plus de liens…","clicks":{"one":"%{count} clic","other":"%{count} clics"}},"post_links":{"about":"développer plus de liens pour ce message","title":{"one":"%{count} autre","other":"%{count} autres "}},"topic_statuses":{"warning":{"help":"Ceci est un avertissement officiel."},"bookmarked":{"help":"Vous avez mis un signet à ce sujet"},"locked":{"help":"Ce sujet est fermé ; il n'accepte plus de nouvelles réponses"},"archived":{"help":"Ce sujet est archivé ; il est figé et ne peut être modifié"},"locked_and_archived":{"help":"Ce sujet est fermé et archivé ; il n'accepte plus de nouvelles réponses et ne peut plus être modifié"},"unpinned":{"title":"Désépinglé","help":"Ce sujet est désépinglé pour vous ; il sera affiché dans l'ordre par défaut"},"pinned_globally":{"title":"Épinglé globalement","help":"Ce sujet est épinglé globalement ; il apparaîtra en premier dans la liste des derniers sujets et dans sa catégorie"},"pinned":{"title":"Épinglé","help":"Ce sujet est épinglé pour vous ; il s'affichera en haut de sa catégorie"},"unlisted":{"help":"Ce sujet n'apparait plus dans la liste des sujets et sera seulement accessible via un lien direct"},"personal_message":{"title":"Ce sujet est un message personnel","help":"Ce sujet est un message personnel"}},"posts":"Messages","posts_long":"il y a {{number}} messages dans ce sujet","original_post":"Message original","views":"Vues","views_lowercase":{"one":"vue","other":"vues"},"replies":"Réponses","views_long":{"one":"ce sujet a été vu %{count} fois","other":"ce sujet a été vu {{number}} fois"},"activity":"Activité","likes":"J'aime","likes_lowercase":{"one":"J'aime","other":"J'aime"},"likes_long":"il y a {{number}} J'aime dans ce sujet","users":"Utilisateurs","users_lowercase":{"one":"utilisateur","other":"utilisateurs"},"category_title":"Catégorie","history":"Historique","changed_by":"par {{author}}","raw_email":{"title":"Courriel entrant","not_available":"Indisponible !"},"categories_list":"Liste des catégories","filters":{"with_topics":"Sujets %{filter}","with_category":"Sujets %{filter} sur %{category}","latest":{"title":"Récents","title_with_count":{"one":"Récent ({{count}})","other":"Récents ({{count}})"},"help":"sujets avec des messages récents"},"read":{"title":"Lus","help":"sujets que vous avez lus, dans l'ordre de dernière lecture"},"categories":{"title":"Catégories","title_in":"Catégorie - {{categoryName}}","help":"tous les sujets regroupés par catégorie"},"unread":{"title":"Non lus","title_with_count":{"one":"Non lu (%{count})","other":"Non lus ({{count}})"},"help":"sujets avec des messages non lus que vous suivez ou surveillez","lower_title_with_count":{"one":"%{count} non lu","other":"{{count}} non lus"}},"new":{"lower_title_with_count":{"one":"%{count} nouveau","other":"{{count}} nouveaux"},"lower_title":"nouveau","title":"Nouveaux","title_with_count":{"one":"Nouveau (%{count})","other":"Nouveaux ({{count}})"},"help":"sujets créés dans les derniers jours"},"posted":{"title":"Mes Messages","help":"sujets auxquels vous avez participé"},"bookmarks":{"title":"Signets","help":"sujets auxquels vous avez mis un signet"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"derniers sujets dans la catégorie {{categoryName}}"},"top":{"title":"Top","help":"les meilleurs sujets de l'année, du mois, de la semaine ou du jour","all":{"title":"Depuis toujours"},"yearly":{"title":"Annuel"},"quarterly":{"title":"Trimestriel"},"monthly":{"title":"Mensuel"},"weekly":{"title":"Hebdomadaire"},"daily":{"title":"Quotidien"},"all_time":"Depuis toujours","this_year":"Année","this_quarter":"Trimestre","this_month":"Mois","this_week":"Semaine","today":"Aujourd'hui","other_periods":"voir le top"},"votes":{"title":"Votes","help":"sujets les plus votés"}},"browser_update":"Malheureusement, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003evotre navigateur est trop vieux pour ce site\u003c/a\u003e. Merci \u003ca href=\"https://browsehappy.com\"\u003ede mettre à jour votre navigateur\u003c/a\u003e.","permission_types":{"full":"Créer / Répondre / Voir","create_post":"Répondre / Voir","readonly":"Voir"},"lightbox":{"download":"télécharger","previous":"Précédent (touche flèche gauche)","next":"Suivant (touche flèche droite)","counter":"%curr% de %total%","close":"Femer (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eCe contenu\u003c/a\u003e ne pouvait pas être chargé.","image_load_error":"\u003ca href=\"%url%\"\u003eCette image\u003c/a\u003e ne pouvait pas être chargé."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} ou %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Raccourcis clavier","jump_to":{"title":"Aller à","home":"%{shortcut} Accueil","latest":"%{shortcut} Récents","new":"%{shortcut} Nouveaux","unread":"%{shortcut} Non lus","categories":"%{shortcut} Catégories","top":"%{shortcut} Top","bookmarks":"%{shortcut} Signets","profile":"%{shortcut} Profil","messages":"%{shortcut} Messages","drafts":"%{shortcut} Brouillons"},"navigation":{"title":"Navigation","jump":"%{shortcut} Aller au sujet #","back":"%{shortcut} Retour","up_down":"%{shortcut} Déplacer la sélection \u0026uarr; \u0026darr;","open":"%{shortcut} Ouvrir le sujet sélectionné","next_prev":"%{shortcut} Section suivante/précédente","go_to_unread_post":"%{shortcut} Voir le premier message non lu"},"application":{"title":"Application","create":"%{shortcut} Créer un nouveau sujet","notifications":"%{shortcut} Ouvrir les notifications","hamburger_menu":"%{shortcut} Ouvrir le menu hamburger","user_profile_menu":"%{shortcut}Ouvrir le menu utilisateur","show_incoming_updated_topics":"%{shortcut} Montrer les sujets mis à jour récemment","search":"%{shortcut} Rechercher","help":"%{shortcut} Ouvrir l'aide du clavier","dismiss_new_posts":"%{shortcut} Ignorer les nouveaux messages","dismiss_topics":"%{shortcut} Ignorer les sujets","log_out":"%{shortcut} Se déconnecter"},"composing":{"title":"Edition","return":"%{shortcut} Revenir à l'éditeur","fullscreen":"%{shortcut} Editeur plein écran"},"actions":{"title":"Actions","bookmark_topic":"%{shortcut} Modifier le signet du sujet","pin_unpin_topic":"%{shortcut} Épingler/désépingler le sujet","share_topic":"%{shortcut} Partager le sujet","share_post":"%{shortcut} Partager le message","reply_as_new_topic":"%{shortcut} Répondre en tant que sujet lié","reply_topic":"%{shortcut} Répondre au sujet","reply_post":"%{shortcut} Répondre au message","quote_post":"%{shortcut} Citer le message","like":"%{shortcut} Aimer le message","flag":"%{shortcut} Signaler le message","bookmark":"%{shortcut} Mettre un signet au message","edit":"%{shortcut} Modifier le message","delete":"%{shortcut} Supprimer le message","mark_muted":"%{shortcut} Mettre le sujet en silencieux","mark_regular":"%{shortcut} Notifications par défaut pour le sujet","mark_tracking":"%{shortcut} Suivre le sujet","mark_watching":"%{shortcut} Surveiller le sujet","print":"%{shortcut} Imprimer le sujet","defer":"%{shortcut} Reporter le sujet","topic_admin_actions":"%{shortcut} Ouvrir les actions d'administration sur ce sujet"}},"badges":{"earned_n_times":{"one":"A reçu ce badge %{count} fois","other":"A reçu ce badge %{count} fois"},"granted_on":"Accordé %{date}","others_count":"Autres utilisateurs avec ce badge (%{count})","title":"Badges","allow_title":"Vous pouvez utiliser ce badge comme titre","multiple_grant":"Vous pouvez le gagner de multiples fois","badge_count":{"one":"%{count} badge","other":"%{count} badges"},"more_badges":{"one":"+%{count} autre","other":"+%{count} autres"},"granted":{"one":"%{count} décerné","other":"%{count} décernés"},"select_badge_for_title":"Sélectionner un badge comme titre","none":"(aucun)","successfully_granted":"%{badge} accordé à %{username} avec succès","badge_grouping":{"getting_started":{"name":"Initiation"},"community":{"name":"Communauté"},"trust_level":{"name":"Niveau de confiance"},"other":{"name":"Autre"},"posting":{"name":"Contribution"}}},"tagging":{"all_tags":"Toutes les étiquettes","other_tags":"Autres étiquettes","selector_all_tags":"toutes les étiquettes","selector_no_tags":"aucune étiquette","changed":"étiquettes modifiées :","tags":"Étiquettes","choose_for_topic":"étiquettes optionnelles","info":"Information","default_info":"Cette étiquette n'est pas limitée à une catégorie et n'a aucun synonyme.","category_restricted":"Cette étiquette est limitée à des catégories dont vous n'avez pas la permission d'accéder.","synonyms":"Synonymes","synonyms_description":"Quand les étiquettes suivantes sont utilisées, elles seront remplacées par \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"Cette étiquette appartient au groupe « {{tag_groups}} ».","other":"Cette étiquette appartient à ces groupes : {{tag_groups}}."},"category_restrictions":{"one":"Elle ne peut être utilisée que dans cette catégorie :","other":"Elle ne peut être utilisée que dans ces catégories :"},"edit_synonyms":"Gérer les synonymes","add_synonyms_label":"Ajouter des synonymes :","add_synonyms":"Ajouter","add_synonyms_failed":"Les étiquettes suivantes n'ont pas pu être ajoutées comme synonymes : \u003cb\u003e%{tag_names}\u003c/b\u003e. Assurez-vous qu'elles n'ont pas de synonymes et ne sont pas des synonymes d'une autre étiquette.","remove_synonym":"Supprimer le synonyme","delete_synonym_confirm":"Êtes-vous sur de vouloir supprimer le synonyme « %{tag_name} » ?","delete_tag":"Supprimer l'étiquette","delete_confirm":{"one":"Êtes-vous sûr de vouloir supprimer cette étiquettes et l'enlever de %{count} sujet auquel elle est assignée ?","other":"Êtes-vous sûr de vouloir supprimer cette étiquette et l'enlever de {{count}} sujets auxquels elle est assignée ?"},"delete_confirm_no_topics":"Êtes-vous sûr de vouloir supprimer cette étiquette ?","delete_confirm_synonyms":{"one":"Son synonyme sera aussi supprimé.","other":"Ses {{count}} synonymes seront aussi supprimés."},"rename_tag":"Renommer l'étiquette","rename_instructions":"Choisir un nouveau nom pour cette étiquette :","sort_by":"Trier par :","sort_by_count":"nombre","sort_by_name":"nom","manage_groups":"Gérer les groupes d'étiquette","manage_groups_description":"Définir des groupes pour organiser les étiquettes","upload":"Télécharger des étiquettes","upload_description":"Télécharger un fichier csv pour créer des étiquettes en masse","upload_instructions":"Un par ligne, avec optionnellement un groupe d'étiquettes sous la forme 'tag_name,tag_group'.","upload_successful":"Étiquettes téléchargées avec succès","delete_unused_confirmation":{"one":"%{count} étiquette sera supprimée : %{tags}","other":"%{count} étiquettes seront supprimées : %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} et %{count} plus","other":"%{tags} et %{count} plus"},"delete_unused":"Supprimer étiquettes inutilisées","delete_unused_description":"Supprimer toutes les étiquettes qui ne sont pas associées à des sujets ou messages directs","cancel_delete_unused":"Annuler","filters":{"without_category":"%{filter} %{tag} sujets","with_category":"%{filter} %{tag} sujets dans %{category}","untagged_without_category":"%{filter} sujets sans étiquette","untagged_with_category":"%{filter} sujets sans étiquette dans %{category}"},"notifications":{"watching":{"title":"Surveiller","description":"Vous surveillerez automatiquement tous les sujets avec cette étiquette. Vous serez notifié de tous les nouveaux messages et sujets, et le nombre de messages non lus et nouveaux apparaîtra à côté du sujet."},"watching_first_post":{"title":"Surveiller les nouveaux sujets","description":"Vous serez averti de nouveaux sujets avec cette étiquette mais pas de réponses aux sujets."},"tracking":{"title":"Suivi","description":"Vous allez suivre automatiquement tous les sujets avec cette étiquette. Le nombre de messages non lus et nouveaux apparaîtra à côté du sujet."},"regular":{"title":"Normal","description":"Vous serez notifié si un utilisateur mentionne votre @pseudo ou répond à votre message."},"muted":{"title":"Silencieux","description":"Vous ne recevrez aucune notification sur des nouveaux sujets avec cette étiquette, et ils n’apparaîtront pas dans l'onglet non lus."}},"groups":{"title":"Groupes d'étiquette","about":"Ajouter des étiquettes aux groupes pour les gérer plus facilement.","new":"Nouveau groupe","tags_label":"Étiquettes dans ce groupe :","tags_placeholder":"Mots clés","parent_tag_label":"Étiquette parent :","parent_tag_placeholder":"Facultatif","parent_tag_description":"Les étiquette de ce groupe ne peuvent pas être utilisées sauf si l'étiquette parent est présente.","one_per_topic_label":"Limiter à une étiquette de ce groupe par sujet","new_name":"Nouveau groupe d'étiquettes","name_placeholder":"Nom du groupe d'étiquette","save":"Sauvegarder","delete":"Supprimer","confirm_delete":"Êtes-vous sûr de vouloir supprimer ce groupe d'étiquettes ?","everyone_can_use":"Les étiquette peuvent être utilisées par tout le monde","usable_only_by_staff":"Les étiquette sont visibles à tous, mais seuls les responsables peuvent les utiliser","visible_only_to_staff":"Les étiquettes ne sont visibles qu'aux responsables"},"topics":{"none":{"unread":"Vous n'avez aucun sujet non lu.","new":"Vous n'avez aucun nouveau sujet.","read":"Vous n'avez lu aucun sujet pour le moment.","posted":"Vous n'avez écrit dans aucun sujet pour le moment.","latest":"Il n'y a pas de sujets récents.","bookmarks":"Vous n'avez pas encore mis de signets à des sujets.","top":"Il n'y a pas de meilleurs sujets."},"bottom":{"latest":"Il n'y a plus de sujets récents.","posted":"Il n'y a plus de sujets publiés.","read":"Il n'y a plus de sujets lus.","new":"Il n'y a plus de nouveaux sujets.","unread":"Il n'y a plus de sujets non lus.","top":"Il n'y a plus de meilleurs sujets.","bookmarks":"Il n'y a plus de sujets avec des signets."}}},"invite":{"custom_message":"Rendez votre invitation plus personnelle en écrivant un \u003ca href\u003emessage personnalisé\u003c/a\u003e.","custom_message_placeholder":"Entrez votre message personnalisé","custom_message_template_forum":"Hey, tu devrais rejoindre ce forum !","custom_message_template_topic":"Hey, je pensais que tu pourrais aimer ce sujet !"},"forced_anonymous":"En raison de la charge extrême, ceci est temporairement montré à tout le monde comme un utilisateur déconnecté le verrait.","safe_mode":{"enabled":"Le mode sans échec est activé ; fermez cette fenêtre de navigateur pour le quitter"},"poll":{"voters":{"one":"votant","other":"votants"},"total_votes":{"one":"vote au total","other":"votes au total"},"average_rating":"Notation moyenne : \u003cstrong\u003e%{average}\u003c/strong\u003e","public":{"title":"Les votes sont \u003cstrong\u003epublics\u003c/strong\u003e."},"results":{"vote":{"title":"Les résultats sont affichés après avoir \u003cstrong\u003evoté\u003c/strong\u003e."},"closed":{"title":"Les résultats sont affichés après avoir \u003cstrong\u003efermé\u003c/strong\u003e."},"staff":{"title":"Les résultats ne sont montrés qu'aux membres du \u003cstrong\u003epersonnel\u003c/strong\u003e ."}},"multiple":{"help":{"at_least_min_options":{"one":"Choisissez au moins \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choisissez au moins \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"up_to_max_options":{"one":"Choisissez jusqu'à \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choisissez jusqu'à \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"x_options":{"one":"Choisissez \u003cstrong\u003e%{count}\u003c/strong\u003e option","other":"Choisissez \u003cstrong\u003e%{count}\u003c/strong\u003e options"},"between_min_and_max_options":"Choisissez entre \u003cstrong\u003e%{min}\u003c/strong\u003e et \u003cstrong\u003e%{max}\u003c/strong\u003e options"}},"cast-votes":{"title":"Distribuez vos votes","label":"Votez maintenant !"},"show-results":{"title":"Afficher les résultats du sondage","label":"Afficher les résultats"},"hide-results":{"title":"Retourner au vote","label":"Afficher le sondage"},"group-results":{"title":"Grouper les votes par champ utilisateur","label":"Afficher les détails"},"ungroup-results":{"title":"Combiner tous les votes","label":"Cacher les détails"},"export-results":{"title":"Exporter les résultats du sondage","label":"Exporter"},"open":{"title":"Ouvrir le sondage","label":"Ouvrir","confirm":"Êtes-vous sûr de vouloir ouvrir ce sondage ?"},"close":{"title":"Fermer le sondage","label":"Fermer","confirm":"Êtes-vous sûr de vouloir fermer ce sondage ?"},"automatic_close":{"closes_in":"Se termine dans \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"Fermé \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Désolé, il y a eu une erreur lors du changement de statut de ce sondage.","error_while_casting_votes":"Désolé, il y a eu une erreur lors de l'envoi de vos votes.","error_while_fetching_voters":"Désolé, il y a eu une erreur lors de l'affichage des votants.","error_while_exporting_results":"Désolé, une erreur est survenue lors de l'exportation des résultats du sondage.","ui_builder":{"title":"Créer un sondage","insert":"Insérer le sondage","help":{"invalid_values":"La valeur minimum doit être plus petite que la valeur maximum.","min_step_value":"Le valeur minimum du pas est 1"},"poll_type":{"label":"Type","regular":"Choix unique","multiple":"Choix multiple","number":"Nombre"},"poll_result":{"label":"Résultats","always":"Toujours visible","vote":"Lors du vote","closed":"A la fermeture","staff":"Personnel seulement"},"poll_chart_type":{"label":"Type de graphique"},"poll_config":{"max":"Max","min":"Min","step":"Pas"},"poll_public":{"label":"Afficher les votants"},"poll_options":{"label":"Entrez une option de sondage par ligne"},"automatic_close":{"label":"Fermer sondage automatiquement"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Démarrer le tutoriel nouvel utilisateur pour tous les utilisateurs","welcome_message":"Envoyer à tous les utilisateurs un message de bienvenue avec un guide de démarrage rapide "}},"discourse_local_dates":{"relative_dates":{"today":"Aujourd'hui %{time}","tomorrow":"Demain %{time}","yesterday":"Hier %{time}","countdown":{"passed":"la date est passée"}},"title":"Insérer date / heure","create":{"form":{"insert":"Insérer","advanced_mode":"Mode avancé","simple_mode":"Mode simple","format_description":"Format utilisé pour afficher la date pour l'utilisateur. Utiliser \"\\T\\Z\" pour afficher le fuseaux horaire de l'utilisateur en toutes lettres (Europe/Paris)","timezones_title":"Fuseaux horaires à afficher","timezones_description":"Les fuseaux horaires seront utilisés pour afficher les dates en aperçu et en mode recours.","recurring_title":"Périodicité","recurring_description":"Définir la périodicité d'un événement. Vous pouvez aussi modifier manuellement l'option de périodicité générée par le formulaire et utiliser une des clefs suivantes : years, quarters, months, weeks, days, hours, minutes, seconds, milliseconds. ","recurring_none":"Pas de périodicité","invalid_date":"Date invalide, contrôler que la date et l'heure sont correctes","date_title":"Date","time_title":"Time","format_title":"Format de date","timezone":"Fuseau horaire","until":"Jusqu'à...","recurring":{"every_day":"Tous les jours","every_week":"Toutes les semaines","every_two_weeks":"Tous les 15 jours","every_month":"Tous les mois","every_two_months":"Tous les deux mois","every_three_months":"Tous les trois mois","every_six_months":"Tous les six mois","every_year":"Tous les ans"}}}},"details":{"title":"Cacher le texte"},"presence":{"replying":"en train de répondre","editing":"en train de modifier","replying_to_topic":{"one":"en train de répondre","other":"en train de répondre"}},"voting":{"title":"Votation","reached_limit":"Vous n'avez plus de votes disponibles, enlevez-en un !","list_votes":"Lister vos votes","votes_nav_help":"sujets les plus votés","voted":"Vous avez voté pour ce sujet","allow_topic_voting":"Autoriser les utilisateurs à voter dans cette catégorie","vote_title":"Vote","vote_title_plural":"Votes","voted_title":"Voté","voting_closed_title":"Fermé","voting_limit":"Limite","votes_left":{"one":"Vous avec {{count}} vote restant, consultez \u003ca href='{{path}}'\u003evos votes\u003c/a\u003e.","other":"Vous avez {{count}} votes restant, consultez \u003ca href='{{path}}'\u003evos votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote","other":"{{count}} votes"},"anonymous_button":{"one":"Vote","other":"Votes"},"remove_vote":"Retirer vote"},"adplugin":{"advertisement_label":"PUBLICITE"}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"next_business_day":"下一个工作日","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"user":{"use_current_timezone":"使用现在的时区","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor":{"totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"}},"modal":{"dismiss_error":"忽略错误"},"composer":{"composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}"}},"topic":{"topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"bookmarks":{"edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"}},"poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"}},"ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_groups":{"label":"允许的群组"}}},"docker":{"upgrade":"当前使用 Discourse 的旧版本。","perform_upgrade":"点击这里升级。"}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"}},"tagging":{"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'fr';
I18n.pluralizationRules.fr = MessageFormat.locale.fr;
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


    var fr = moment.defineLocale('fr', {
        months : 'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'.split('_'),
        monthsShort : 'janv._févr._mars_avr._mai_juin_juil._août_sept._oct._nov._déc.'.split('_'),
        monthsParseExact : true,
        weekdays : 'dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi'.split('_'),
        weekdaysShort : 'dim._lun._mar._mer._jeu._ven._sam.'.split('_'),
        weekdaysMin : 'di_lu_ma_me_je_ve_sa'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[Aujourd’hui à] LT',
            nextDay : '[Demain à] LT',
            nextWeek : 'dddd [à] LT',
            lastDay : '[Hier à] LT',
            lastWeek : 'dddd [dernier à] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'dans %s',
            past : 'il y a %s',
            s : 'quelques secondes',
            ss : '%d secondes',
            m : 'une minute',
            mm : '%d minutes',
            h : 'une heure',
            hh : '%d heures',
            d : 'un jour',
            dd : '%d jours',
            M : 'un mois',
            MM : '%d mois',
            y : 'un an',
            yy : '%d ans'
        },
        dayOfMonthOrdinalParse: /\d{1,2}(er|)/,
        ordinal : function (number, period) {
            switch (period) {
                // TODO: Return 'e' when day of month > 1. Move this case inside
                // block for masculine words below.
                // See https://github.com/moment/moment/issues/3375
                case 'D':
                    return number + (number === 1 ? 'er' : '');

                // Words with masculine grammatical gender: mois, trimestre, jour
                default:
                case 'M':
                case 'Q':
                case 'DDD':
                case 'd':
                    return number + (number === 1 ? 'er' : 'e');

                // Words with feminine grammatical gender: semaine
                case 'w':
                case 'W':
                    return number + (number === 1 ? 're' : 'e');
            }
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return fr;

})));

// moment-timezone-localization for lang code: fr

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis-Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Alger","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Le Caire","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Djibouti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Laâyoune","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Khartoum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadiscio","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"N’Djamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli (Libye)","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaína","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Río Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucumán","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaïa","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia de Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"La Barbade","id":"America/Barbados"},{"value":"America/Belem","name":"Belém","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancún","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Caïmans","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiabá","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Détroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominique","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepé","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenade","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"La Havane","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox [Indiana]","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo [Indiana]","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg [Indiana]","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City [Indiana]","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay [Indiana]","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes [Indiana]","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac [Indiana]","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaïque","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello [Kentucky]","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceió","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaos","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinique","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlán","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Mérida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Mexico","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah (Dakota du Nord)","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center (Dakota du Nord)","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem (Dakota du Nord)","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port-d’Espagne","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Porto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarém","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Saint-Domingue","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint-Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"Saint-Jean de Terre-Neuve","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Saint-Christophe","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Sainte-Lucie","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Saint-Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Saint-Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tégucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thulé","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Showa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Alma Ata","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktaou","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktioubinsk","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Achgabat","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyraou","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahreïn","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Bakou","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beyrouth","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bichkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Calcutta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Tchita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Tchoïbalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damas","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dhaka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubaï","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Douchanbé","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagouste","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hébron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hong Kong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkoutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Jakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jérusalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kaboul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamtchatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandou","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Khandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnoïarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Koweït","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Macassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manille","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Mascate","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicosie","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novossibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Ouralsk","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pyongyang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Qatar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kzyl Orda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangoun","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riyad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Hô-Chi-Minh-Ville","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sakhaline","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarcande","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Séoul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Shanghai","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapour","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Tachkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilissi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Téhéran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokyo","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Oulan-Bator","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Ürümqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Iakoutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Ekaterinbourg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Erevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Açores","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermudes","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Îles Canaries","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Cap-Vert","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Féroé","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madère","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Géorgie du Sud","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Sainte-Hélène","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adélaïde","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Temps universel coordonnéTU","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorre","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrakhan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Athènes","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrade","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlin","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Bruxelles","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bucarest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Büsingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chisinau","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Copenhague","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"heure d’été irlandaiseDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernesey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Île de Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisbonne","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"heure d’été britanniqueLondres","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxembourg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malte","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moscou","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paris","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Prague","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Rome","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"Saint-Marin","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stockholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Oulianovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Oujgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Le Vatican","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Vienne","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varsovie","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporojie","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zurich","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Christmas","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comores","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahé","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldives","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Maurice","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"La Réunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Île de Pâques","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Éfaté","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fidji","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galápagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"HTHSTHDTHonolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marquises","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Nouméa","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
