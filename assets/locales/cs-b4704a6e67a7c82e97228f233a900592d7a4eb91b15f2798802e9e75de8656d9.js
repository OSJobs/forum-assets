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
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
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
r += "Zbývá <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 nepřečtené</a> téma ";
return r;
},
"other" : function(d){
var r = "";
r += "Je tu <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " nepřečtených</a> témat ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "/new'>1 nové</a> téma";
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
r += "are ";
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
})() + " nových</a> témat";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", nebo ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "zobrazit další témata v kategorii ";
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
r += "Chystáte se odstranit ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> příspěvek";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> příspěvků";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " a ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> téma";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> témat";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " od tohoto uživatele, smazat jeho účet, zablokovat přihlášení z jejich IP adresy <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b>, a přidat jejich emailovou adresu <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> na seznam permanentně blokovaných. Jste si jistí, že je tento uživatel opravdu spamer?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Toto téma má ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 příspěvek";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " příspěvků";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "s vysokým počtem lajků";
return r;
},
"med" : function(d){
var r = "";
r += "s velmi vysokým počtem lajků";
return r;
},
"high" : function(d){
var r = "";
r += "s extrémně vysokým počtem lajků";
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
r += "Chystáte se smazat ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 příspěvek";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " příspěvků";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 téma";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " témat";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". Jste si jistí?";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>达到了站点设置中的限制";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经达到站点设置限制 ";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>超出了站点设置中的限制";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经超出站点设置限制 ";
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
r += (pf_0[ MessageFormat.locale["cs"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.cs = function (n) {
  if (n == 1) {
    return 'one';
  }
  if (n == 2 || n == 3 || n == 4) {
    return 'few';
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

I18n.translations = {"cs":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"bajt","few":"bajty","many":"bajtů","other":"bajtů"},"gb":"GB","kb":"kB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"H:mm","time_with_zone":"H:mm (z)","timeline_date":"MMM YYYY","long_no_year_no_time":"D. MMMM","full_no_year_no_time":"D. MMMM","long_with_year":"D. M. YYYY, H:mm","long_with_year_no_time":"D. M. YYYY","full_with_year_no_time":"D. MMMM YYYY","long_date_with_year":"D. M. YYYY, H:mm","long_date_without_year":"D. MMMM, H:mm","long_date_with_year_without_time":"D. M. YYYY","long_date_without_year_with_linebreak":"D. MMMM \u003cbr/\u003eH:mm","long_date_with_year_with_linebreak":"D. M. YYYY \u003cbr/\u003eH:mm","wrap_ago":"před %{date}","tiny":{"half_a_minute":"\u003c 1m","less_than_x_seconds":{"one":"\u003c %{count}s","few":"\u003c %{count}s","many":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","few":"%{count}s","many":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m","few":"\u003c %{count}m","many":"\u003c %{count}m","other":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m","few":"%{count}m","many":"%{count}m","other":"%{count}m"},"about_x_hours":{"one":"%{count}h","few":"%{count}h","many":"%{count}h","other":"%{count}h"},"x_days":{"one":"%{count}d","few":"%{count}d","many":"%{count}d","other":"%{count}d"},"x_months":{"one":"%{count} měsíc","few":"%{count} měsíce","many":"%{count} měsíců","other":"%{count} měsíců"},"about_x_years":{"one":"%{count}r","few":"%{count}r","many":"%{count}let","other":"%{count}let"},"over_x_years":{"one":"\u003e %{count}r","few":"\u003e %{count}r","many":"\u003e %{count}let","other":"\u003e %{count}let"},"almost_x_years":{"one":"%{count}r","few":"%{count}r","many":"%{count}let","other":"%{count}let"},"date_month":"D. MMMM","date_year":"MMMM YYYY"},"medium":{"x_minutes":{"one":"%{count} minuta","few":"%{count} minuty","many":"%{count} minut","other":"%{count} minut"},"x_hours":{"one":"%{count} hodina","few":"%{count} hodiny","many":"%{count} hodin","other":"%{count} hodin"},"x_days":{"one":"%{count} den","few":"%{count} dny","many":"%{count} dní","other":"%{count} dní"},"date_year":"D. M. YYYY"},"medium_with_ago":{"x_minutes":{"one":"před %{count} minutou","few":"před %{count} minutami","many":"před %{count} minutami","other":"před %{count} minutami"},"x_hours":{"one":"před %{count} hodinou","few":"před %{count} hodinami","many":"před %{count} hodinami","other":"před %{count} hodinami"},"x_days":{"one":"před %{count} dnem","few":"před %{count} dny","many":"před %{count} dny","other":"před %{count} dny"}},"later":{"x_days":{"one":"za %{count} den","few":"za %{count} dny","many":"o %{count} dní později","other":"o %{count} dní později"},"x_months":{"one":"za %{count} měsíc","few":"za %{count} měsíce","many":"o %{count} měsíců později","other":"o %{count} měsíců později"},"x_years":{"one":"za %{count} rok","few":"za %{count} roků","many":"o %{count} let později","other":"o %{count} let později"}},"previous_month":"Předchozí měsíc","next_month":"Další měsíc","placeholder":"datum"},"share":{"post":"příspěvek #%{postNumber}","close":"zavřít","twitter":"Sdílet odkaz na Twitteru","facebook":"Sdílet odkaz na Facebooku","email":"Odeslat odkaz emailem"},"action_codes":{"public_topic":"Téma zveřejněno %{when}","private_topic":"Téma změněno na osobní zprávu %{when}","split_topic":"rozdělil toto téma %{when}","invited_user":"%{who} pozván %{when}","invited_group":"%{who} pozvána %{when}","user_left":"%{who} se odstranil z této zpráy %{when}","removed_user":"%{who} smazán %{when}","removed_group":"%{who} smazána %{when}","autobumped":"automaticky bumped %{when}","autoclosed":{"enabled":"uzavřeno %{when}","disabled":"otevřeno %{when}"},"closed":{"enabled":"uzavřeno %{when}","disabled":"otevřeno %{when}"},"archived":{"enabled":"archivováno %{when}","disabled":"odarchivováno %{when}"},"pinned":{"enabled":"připnuto %{when}","disabled":"odepnuto %{when}"},"pinned_globally":{"enabled":"globálně připnuto %{when}","disabled":"odepnuto %{when}"},"visible":{"enabled":"uvedeno %{when}","disabled":"neuvedeno %{when}"},"banner":{"enabled":"vytvořil(a) tento banner %{when}. Bude se zobrazovat nahoře na každé stránce, dokud nebude uživatelem odmítnut.","disabled":"odstranil(a) tento banner %{when}. Už se nebude zobrazovat na každé stránce nahoře."}},"wizard_required":"Vítejte ve vašem novém Discourse! Začněte s \u003ca href='%{url}' data-auto-route='true'\u003enastavením pomocí průvodce\u003c/a\u003e ✨","emails_are_disabled":"Všechny odchozí emaily byly administrátorem vypnuty. Žádné odchozí emaily nebudou odeslány.","bootstrap_mode_enabled":"Aby se váš web jednodušeji rozjel, nachází se v režimu bootstrap. Všichni noví uživatelé začínají s důveryhodností 1 a mají povolené denní odesílání souhrnných emailů. Tento režim se automaticky vypne, jakmile se zaregistruje alespoň %{min_users} uživatelů.","bootstrap_mode_disabled":"Režim bootstrap bude deaktivován v následujících 24 hodinách.","themes":{"default_description":"Výchozí"},"s3":{"regions":{"ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Soul)","ap_south_1":"Asia Pacific (Bombaj)","ap_southeast_1":"Asia Pacific (Singapur)","ap_southeast_2":"Asia Pacific (Sydney)","cn_north_1":"Čína (Peking)","cn_northwest_1":"Čína (Ningxia)","eu_central_1":"EU (Frankfurt)","eu_west_1":"EU (Irsko)","eu_west_2":"EU (Londýn)","eu_west_3":"EU (Paříž)","us_east_1":"Východ USA (S. Virginie)","us_east_2":"Východ USA (Ohio)","us_west_1":"Západ USA (S. Kalifornie)","us_west_2":"Západ USA (Oregon)"}},"edit":"upravit název a kategorii příspěvku","expand":"Rozšířit","not_implemented":"Tato funkce ještě nebyla naprogramována, omlouváme se.","no_value":"Ne","yes_value":"Ano","submit":"Odeslat","generic_error":"Bohužel nastala chyba.","generic_error_with_reason":"Nastala chyba: %{error}","sign_up":"Registrace","log_in":"Přihlásit se","age":"Věk","joined":"Účet vytvořen","admin_title":"Administrace","show_more":"zobrazit více","show_help":"možnosti","links":"Odkazy","links_lowercase":{"one":"odkaz","few":"odkazy","many":"odkazů","other":"odkazů"},"faq":"FAQ","guidelines":"Pokyny","privacy_policy":"Ochrana soukromí","privacy":"Soukromí","tos":"Podmínky používání","rules":"Pravidla","mobile_view":"Mobilní verze","desktop_view":"Plná verze","you":"Vy","or":"nebo","now":"právě teď","read_more":"číst dále","more":"Více","less":"Méně","never":"nikdy","every_30_minutes":"každých 30 minut","every_hour":"každou hodinu","daily":"denně","weekly":"týdně","every_month":"každý měsíc","every_six_months":"každých šest měsíců","max_of_count":"max z","alternation":"nebo","character_count":{"one":"{{count}} znak","few":"{{count}} znaky","many":"{{count}} znaků","other":"{{count}} znaků"},"related_messages":{"title":"Související zprávy","see_all":"Zobrazit \u003ca href=\"%{path}\"\u003evšechny zprávy\u003c/a\u003eod @%{username}"},"suggested_topics":{"title":"Doporučená témata","pm_title":"Doporučené zprávy"},"about":{"simple_title":"O fóru","title":"O %{title}","stats":"Statistiky webu","our_admins":"Naši Admini","our_moderators":"Naši Moderátoři","moderators":"Moderátoři","stat":{"all_time":"Za celou dobu","last_7_days":"Posledních 7","last_30_days":"Posledních 30"},"like_count":"Líbí se","topic_count":"Témata","post_count":"Příspěvky","user_count":"Uživatelé","active_user_count":"Aktivní uživatelé","contact":"Kontaktujte nás","contact_info":"V případě kritické chyby nebo urgentní záležitosti ovlivňující tuto stránku nás prosím kontaktujte na %{contact_info}."},"bookmarked":{"title":"Záložka","clear_bookmarks":"Odstranit záložky","help":{"bookmark":"Kliknutím vložíte záložku na první příspěvek tohoto tématu","unbookmark":"Kliknutím odstraníte všechny záložky v tématu"}},"bookmarks":{"created":"Záložka byla přidána.","not_bookmarked":"přidat záložku k příspěvku","remove":"Odstranit záložku","confirm_clear":"Opravdu chcete odstranit všechny své záložky z tohoto tématu?","save":"Uložit","reminders":{"later_today":"Později během dnešního dne","tomorrow":"Zítra","next_week":"Další týden","later_this_week":"Později během tohoto týdne","next_month":"Další měsíc"}},"drafts":{"resume":"Pokračovat","remove":"Odstranit","new_topic":"Nový koncept tématu","new_private_message":"Nový koncept soukromé zprávy","topic_reply":"Koncept odpovědi","abandon":{"yes_value":"Ano, zahodit","no_value":"Nezahazovat"}},"topic_count_latest":{"one":"Zobrazit {{count}} nové nebo upravené téma","few":"Zobrazit {{count}} nová nebo upravená témata","many":"Zobrazit {{count}} nových nebo upravených témat","other":"Zobrazit {{count}} nových nebo upravených témat"},"topic_count_unread":{"one":"Zobrazit {{count}} nepřečtené téma","few":"Zobrazit {{count}} nepřečtená témata","many":"Zobrazit {{count}} nepřečtených témat","other":"Zobrazit {{count}} nepřečtených témat"},"topic_count_new":{"one":"Zobrazit {{count}} nové téma","few":"Zobrazit {{count}} nová témata","many":"Zobrazit {{count}} nových témat","other":"Zobrazit {{count}} nových témat"},"preview":"ukázka","cancel":"zrušit","save":"Uložit změny","saving":"Ukládám...","saved":"Uloženo!","upload":"Obrázek","uploading":"Nahrávám...","uploading_filename":"Nahrává se {{filename}}...","clipboard":"schránka","uploaded":"Nahráno!","pasting":"Vkládám...","enable":"Zapnout","disable":"Vypnout","continue":"Pokračovat","undo":"Zpět","revert":"Vrátit","failed":"Selhání","switch_to_anon":"Vstoupit do anonymního módu","switch_from_anon":"Opustit anonymní mód","banner":{"close":"Odmítnout tento banner.","edit":"Editujte tento banner \u003e\u003e"},"choose_topic":{"none_found":"Žádná témata nenalezena."},"review":{"in_reply_to":"v odpovědi na","explain":{"total":"Celkem"},"delete":"Smazat","settings":{"save_changes":"Uložit změny","title":"Nastavení"},"moderation_history":"Historie moderování","topic":"Téma:","filtered_user":"Uživatel","user":{"username":"Uživatelské jméno","email":"Email","name":"Jméno"},"topics":{"topic":"Témata","details":"podrobnosti"},"edit":"Upravit","save":"Uložit","cancel":"Zrušit","filters":{"type":{"title":"Typ"},"refresh":"Obnovit","category":"Kategorie"},"scores":{"type":"Typ"},"statuses":{"pending":{"title":"Čeká na schválení"},"rejected":{"title":"Odmítnutých"}},"types":{"reviewable_user":{"title":"Uživatel"}},"approval":{"title":"Příspěvek potřebuje schválení","description":"Obdrželi jsme váš příspěvek, ale musí být před zveřejněním schválen moderátorem. Buďte trpěliví.","ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e zaslal \u003ca href='{{topicUrl}}'\u003etéma\u003c/a\u003e","you_posted_topic":"Zaslal jste \u003ca href='{{topicUrl}}'\u003etéma\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e odpověděl na příspěvek \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"Odpověděl jste na příspěvek \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e přispěl do \u003ca href='{{topicUrl}}'\u003etématu\u003c/a\u003e","you_replied_to_topic":"Přispěl jste do \u003ca href='{{topicUrl}}'\u003etématu\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e zmínil uživatele \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003evás\u003c/a\u003e zmínil","you_mentioned_user":"Zmínil jste uživatele \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Příspěvěk od \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Odesláno \u003ca href='{{userUrl}}'\u003evámi\u003c/a\u003e","sent_by_user":"Posláno uživatelem \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Posláno \u003ca href='{{userUrl}}'\u003evámi\u003c/a\u003e"},"directory":{"filter_name":"Filtrovat podle uživatelského jména","title":"Uživatelé","likes_given":"Rozdáno","likes_received":"Obdrženo","topics_entered":"Zobrazeno","topics_entered_long":"Zobrazeno témat","time_read":"Čas strávený čtením","topic_count":"Témata","topic_count_long":"Témat vytvořeno","post_count":"Odpovědi","post_count_long":"Odpovědí","no_results":"Žádné výsledky","days_visited":"Návštěv","days_visited_long":"Dní navštíveno","posts_read":"Přečteno","posts_read_long":"Příspěvků přečteno","total_rows":{"one":"%{count} uživatel","few":"%{count} uživatelé","many":"%{count} uživatelů","other":"%{count} uživatelů"}},"group_histories":{"actions":{"change_group_setting":"Změnit nastavení skupiny","add_user_to_group":"Přidat uživatele","remove_user_from_group":"Odebrat uživatele","make_user_group_owner":"Udělej vlastníkem","remove_user_as_group_owner":"Odstraň vlastníka"}},"groups":{"member_added":"Přidáno","add_members":{"title":"Přidat členy","description":"Spravovat členství v této skupině","usernames":"Uživatelská jména"},"requests":{"reason":"Reason","accepted":"přijato"},"manage":{"title":"Spravovat","name":"Název","full_name":"Celé název","add_members":"Přidat členy","delete_member_confirm":"Odstranit '%{username}' ze '%{group}' skupiny?","profile":{"title":"Profil"},"interaction":{"title":"Interakce","posting":"Přispívání","notification":"Notifikace"},"membership":{"title":"Členství","access":"Přístup"},"logs":{"title":"Logy","when":"Když","action":"Akce","acting_user":"Vystupující uživatel","target_user":"Cílový uživatel","subject":"Předmět","details":"Podrobnosti","from":"Od","to":"Komu"}},"public_admission":"Povolit uživatelům volný přístup do skupiny (skupina musí být veřejně viditelná)","public_exit":"Povolit uživatelům volně opustit skupinu","empty":{"posts":"V této skupině není od žádného člena ani jeden příspěvek.","members":"V této skupině není žádny uživatel.","mentions":"O této skupině nepadla žádná zmínka.","messages":"Pro tuto skupinu není žádná zpráva.","topics":"V této skupině není od žádného člena ani jedno téma.","logs":"Pro tuto skupinu neexistují žádné logy."},"add":"Přidat","join":"Přidat se ke skupině","leave":"Opustit skupinu","request":"Požádat o členství ve skupině","message":"Zpráva","membership_request_template":"Šablona, která se uživatelům zobrazí při odesílání žádosti o členství","membership_request":{"submit":"Odeslat požadavek","title":"Žádost o členství v @%{group_name}","reason":"Informovat vlastníky skupiny proč patříte do této skupiny"},"membership":"Členství","name":"Název","group_name":"Název skupiny","user_count":"Uživatelé","bio":"O skupině","selector_placeholder":"zadejte uživatelské jméno","owner":"Vlastník","index":{"title":"Skupiny","all":"Všechny skupiny","empty":"Žádné viditelné skupiny.","filter":"Filtrovat podle typu skupiny","owner_groups":"Moje skupiny","close_groups":"Uzavřené skupiny","automatic_groups":"Automatické skupiny","automatic":"Automatické","closed":"Uzavřeno","public":"Veřejné","private":"Soukromé","public_groups":"Veřejné skupiny","automatic_group":"Automatická skupina","close_group":"Zavřít skupinu","my_groups":"Moje skupiny","group_type":"Typ skupiny","is_group_user":"Člen","is_group_owner":"Vlastník"},"title":{"one":"Skupina","few":"Skupiny","many":"Skupin","other":"Skupin"},"activity":"Aktivita","members":{"title":"Členové","filter_placeholder_admin":"uživatelské jméno nebo email","filter_placeholder":"uživatelské jméno","remove_member":"Odstranit člena","remove_member_description":"Odstranit \u003cb\u003e%{username}\u003c/b\u003e z této skupiny","make_owner":"Udělej vlastníkem","make_owner_description":"Udělat z \u003cb\u003e%{username}\u003c/b\u003e vlastníka této skupiny","remove_owner":"Odstranit vlastníka","remove_owner_description":"Odstranit \u003cb\u003e%{username}\u003c/b\u003e z role vlastníka této skupiny","owner":"Vlastník"},"topics":"Témata","posts":"Odpovědi","mentions":"Zmínění","messages":"Zprávy","notification_level":"Výchozí úroveň upozornění pro zprávy ze skupiny","alias_levels":{"mentionable":"Kdo může @zmiňovat tuto skupinu?","messageable":"Kdo může psát zprávy do této skupinu?","nobody":"Nikdo","only_admins":"Pouze správci","mods_and_admins":"Pouze moderátoři a správci","members_mods_and_admins":"Pouze členové skupiny, moderátoři a správci","everyone":"Kdokoliv"},"notifications":{"watching":{"title":"Hlídané","description":"Budete informováni o každém novém příspěvku v každné zprávě a také se vám zobrazí počet nepřečtených příspěvků."},"watching_first_post":{"title":"Hlídané první příspěvky"},"tracking":{"title":"Sledování","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek a zobrazí se vám počet nových odpovědí."},"regular":{"title":"Normální","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"muted":{"title":"Ztišený"}},"flair_url":"Avatar Flair obrázek","flair_url_placeholder":"(Volitelné) URL obrázku nebo třída Font Awesome ","flair_bg_color":"Avatar Flair barva pozadí","flair_bg_color_placeholder":"(Volitelné) Hex kód barvy","flair_color":"Avatar Flair barva","flair_color_placeholder":"(Volitelné) Hex kód barvy","flair_preview_icon":"Náhled ikony","flair_preview_image":"Náhled obrázku"},"user_action_groups":{"1":"Rozdaných 'líbí se'","2":"Obdržených 'líbí se'","3":"Záložky","4":"Témata","5":"Odpovědi","6":"Odezva","7":"Zmínění","9":"Citace","11":"Editace","12":"Odeslané zprávy","13":"Přijaté zprávy","14":"Čeká na schválení","15":"Koncepty"},"categories":{"all":"všechny kategorie","all_subcategories":"vše","no_subcategory":"žádné","category":"Kategorie","category_list":"Zobrazit seznam kategorií","reorder":{"title":"Přeřadit kategorie","title_long":"Přeorganizovat seznam kategorií","save":"Uložit pořadí","apply_all":"Použít","position":"Umístění"},"posts":"Příspěvky","topics":"Témata","latest":"Aktuální","latest_by":"latest by","toggle_ordering":"Přepnout editaci pořadí","subcategories":"Podkategorie","topic_sentence":{"one":"%{count} téma","few":"%{count} témata","many":"%{count} témat","other":"%{count} témat"},"n_more":"Kategorie (a další %{count})..."},"ip_lookup":{"title":"Vyhledávání podle IP adresy","hostname":"Hostname","location":"Lokace","location_not_found":"(neznámá)","organisation":"Organizace","phone":"Telefon","other_accounts":"Další účty s touto IP adresou:","delete_other_accounts":"Smazat %{count}","username":"uživatelské jméno","trust_level":"Důvěra","read_time":"čas k přečtení","topics_entered":"témat zadáno","post_count":"počet příspěvků","confirm_delete_other_accounts":"Určitě chcete smazat tyto účty?","powered_by":"používá \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"zkopírováno"},"user_fields":{"none":"(zvolit možnost)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Ignorovat","edit":"Upravit nastavení","download_archive":{"button_text":"Stáhnout vše","confirm":"Jste si jistí, že chcete stáhnout všechny své příspěvky?","success":"Stahování zahájeno, až bude dokončeno, přijde ti zpráva.","rate_limit_error":"Příspěvky mohou být staženy jen jednou za den. Zkus to, prosím, zítra."},"new_private_message":"Nová zpráva","private_message":"Zpráva","private_messages":"Zprávy","user_notifications":{"ignore_duration_username":"Uživatelské jméno","ignore_duration_save":"ignorovat","mute_option":"Ztišené","normal_option":"Normální"},"activity_stream":"Aktivita","preferences":"Nastavení","feature_topic_on_profile":{"save":"Uložit","clear":{"title":"Zrušit"}},"profile_hidden":"Tento uživatelský profil je skrytý.","expand_profile":"Rozšířit","collapse_profile":"Sbalit","bookmarks":"Záložky","bio":"O mně","invited_by":"Pozvánka od","trust_level":"Důvěryhodnost","notifications":"Oznámení","statistics":"Statistiky","desktop_notifications":{"label":"Upozornění v reálném čase","not_supported":"Tento prohlížeč nepodporuje upozornění. Omlouváme se.","perm_default":"Vypnout upozornění.","perm_denied_btn":"Povolení zamítnuto","perm_denied_expl":"Máte zakázané upozornění. Povolte upozornění v nastavení vašeho prohlížeče.","disable":"Vypnout upozornění","enable":"Povolit upozornění","each_browser_note":"Poznámka: Musíš změnit tuto volbu v každém prohlížeči, který používáš.","consent_prompt":"Chcete dostávat upozornění v reálném čase, když někdo odpoví na vaše příspěvky?"},"dismiss":"Označit jako přečtené","dismiss_notifications":"Označit vše jako přečtené","dismiss_notifications_tooltip":"Označit všechny nepřečtené notifikace jako přečtené","first_notification":"Vaše první notifikace! Klikněte zde a začněte.","allow_private_messages":"Povolit ostatním uživatelům, aby mi mohli zasílat osobní zprávy","external_links_in_new_tab":"Otevírat všechny externí odkazy do nové záložky","enable_quoting":"Povolit odpověď s citací z označeného textu","change":"změnit","moderator":"{{user}} je moderátor","admin":"{{user}} je administrátor","moderator_tooltip":"Tento uživatel je moderátor","admin_tooltip":"Tento uživatel je admi","silenced_tooltip":"Tento uživatel je ztišen.","suspended_notice":"Uživatel je suspendován do {{date}}.","suspended_permanently":"Tento uživatel je suspendován.","suspended_reason":"Důvod: ","github_profile":"Github","email_activity_summary":"Souhrn aktivit","mailing_list_mode":{"label":"Režim elektronická pošta","enabled":"Zapnout režim elektronická pošta","instructions":"Toto nastavení deaktivuje souhrn aktivit.\u003cbr/\u003e\nZtlumená témata a kategorie nejsou zahrnuté v těchto emailech.\n","individual":"Upozornit emailem na každý nový příspěvek","individual_no_echo":"Upozornit emailem na každý nový příspěvek kromě mých vlastních","many_per_day":"Upozornit emailem na každý nový příspěvek (asi {{dailyEmailEstimate}} každý den)","few_per_day":"Upozornit emailem na každý nový příspěvek (asi 2 každý den)","warning":"Režim emailové konference povolen. Nastavení emailových notifikací neplatí."},"tag_settings":"Štítky","watched_tags":"Hlídané","watched_tags_instructions":"Budete automaticky hlídat všechna nová témata s těmito štítky. Na všechny nové příspěvky a témata budete upozorněni. Počet nových příspěvků se zobrazí vedle tématu.","tracked_tags":"Sledované","tracked_tags_instructions":"Budete automaticky sledovat všechna témata s těmito štítky. Počet nových příspěvků se zobrazí vedle tématu.","muted_tags":"Ztišené","muted_tags_instructions":"Nikdy nebudete dostávat upozornění na nová témata s těmito štítky a neobjeví se v aktuálních.","watched_categories":"Hlídané","watched_categories_instructions":"Budete automaticky sledovat všechna nová témata v těchto kategoriích. Na všechny nové příspěvky budete upozorněni. Počet nových příspěvků se zobrazí vedle tématu.","tracked_categories":"Sledované","tracked_categories_instructions":"Všechna témata v této kategorii budou automaticky hlídaná. Počet nepřečtených a nových příspěvků se zobrazí vedle tématu.","watched_first_post_categories":"Hlídané první příspěvky","watched_first_post_categories_instructions":"Budete informováni o prvním novém příspěvku v každém novém tématu vytvořeném v těchto kategoriích.","watched_first_post_tags":"Hlídané první příspěvky","watched_first_post_tags_instructions":"Budete informováni o prvním novém příspěvku v každém novém tématu s těmito štítky.","muted_categories":"Ztišené","muted_categories_instructions":"Nebudete upozorněni na nic o nových tématech v těchto kategoriích ty se neobjeví v přehledu kategorií či v aktuálních,","no_category_access":"Jako moderátor máte omezený přístup ke kategorii bez možnosti ukládat změny.","delete_account":"Smazat můj účet","delete_account_confirm":"Jste si jisti, že chcete trvale odstranit svůj účet? Tuto akci nelze vrátit zpět!","deleted_yourself":"Váš účet byl úspěšně odstraněn.","delete_yourself_not_allowed":"Prosíme kontaktujte správce, pokud chcete smazat svůj účet.","unread_message_count":"Zprávy","admin_delete":"Smazat","users":"Uživatelé","muted_users":"Ztišení","muted_users_instructions":"Umlčet všechny notifikace od těchto uživatelů.","tracked_topics_link":"Zobrazit","automatically_unpin_topics":"Atomaticky odepni téma jakmile se dostanu na konec.","apps":"Aplikace","revoke_access":"Odebrat přístup","undo_revoke_access":"Zrušit odebrání přístupu","api_approved":"Schváleno:","api_last_used_at":"Poslední použití:","theme":"Motiv","home":"Výchozí domovská stránka","staged":"Staged","staff_counters":{"flags_given":"užitečná nahlášení","flagged_posts":"nahlášených příspěvků","deleted_posts":"smazaných příspěvků","suspensions":"vyloučení","warnings_received":"varování"},"messages":{"all":"Všechny","inbox":"Doručené","sent":"Odeslané","archive":"Archív","groups":"Moje skupiny","bulk_select":"Vybrat zprávy","move_to_inbox":"Přesunout do doručených","move_to_archive":"Archivovat","failed_to_move":"Nepodařilo se přesunout vybrané zprávy (možná vám spadlo připojení)","select_all":"Vybrat vše","tags":"Štítek"},"preferences_nav":{"account":"Účet","profile":"Profil","emails":"Emaily","notifications":"Upozornění","categories":"Kategorie","users":"Uživatelé","tags":"Tagy","interface":"Rozhraní","apps":"Aplikace"},"change_password":{"success":"(email odeslán)","in_progress":"(odesílám)","error":"(chyba)","action":"Odeslat email na obnovu hesla","set_password":"Nastavit heslo","choose_new":"Zvolte si nové heslo","choose":"Vyber si heslo"},"second_factor_backup":{"title":"Kódy dvoufaktorové autentizace","regenerate":"Vytvořit znovu","disable":"Vypnout","enable":"Zapnout","enable_long":"Povolit záložní kódy","copied_to_clipboard":"Zkopírováno do schránky","copy_to_clipboard_error":"Chyba při kopírování dat do schránky","remaining_codes":"Zbývá vám \u003cstrong\u003e{{count}}\u003c/strong\u003e záložní kód.","codes":{"title":"Záložní kódy vytvořeny","description":"Každý z těchto kódů může být použit jen jednou. Uložte si je někde v bezpečí, ale dostupné."}},"second_factor":{"title":"Dvoufázové přihlašování","confirm_password_description":"Prosíme před dalším krokem potvrďte své heslo","name":"Jméno","label":"Kód","rate_limit":"Prosím počkejete před tím, než vyskoušíte další ověřovací kód.","disable_description":"Zadejte prosím ověřovací kód z vaší aplikace","show_key_description":"Vložit ručně","extended_description":"Dvoufaktorová autentizace přidává další bezpečnostní vrstvu k vašemu účtu, protože vedle hesla vyžaduje ještě i zadání jednorázového kódu, vytvořeného na zařízeních \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e nebo \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e.\n","oauth_enabled_warning":"Upozorňujeme, že možnost přihlásit se pomocí účtu ze sociální sítě bude vypnuta, jakmila bude na vašem účtu povolena dvoufaktorová autentizace.","edit":"Upravit","security_key":{"delete":"Smazat"}},"change_about":{"title":"Změna o mně","error":"Došlo k chybě při pokusu změnit tuto hodnotu."},"change_username":{"title":"Změnit uživatelské jméno","confirm":"Jste si naprosto jisti, že chcete změnit své uživatelské jméno?","taken":"Toto uživatelské jméno je již zabrané.","invalid":"Uživatelské jméno je neplatné. Musí obsahovat pouze písmena a číslice."},"change_email":{"title":"Změnit emailovou adresu","taken":"Tato emailová adresa není k dispozici.","error":"Nastala chyba při změně emailové adresy. Není tato adresa již používaná?","success":"Na zadanou adresu jsme zaslali email. Následujte, prosím, instrukce v tomto emailu.","success_staff":"Na vaši aktuální adresu jsme zaslali email. Následujte prosím instrukce v tomto emailu."},"change_avatar":{"title":"Změňte si svůj profilový obrázek","letter_based":"Systémem přidělený profilový obrázek","uploaded_avatar":"Vlastní obrázek","uploaded_avatar_empty":"Přidat vlastní obrázek","upload_title":"Nahrát obrázek","image_is_not_a_square":"Varování: Ořízli jsme váš obrázek; šířka a délka nebyla stejná."},"change_card_background":{"title":"Pozadí uživatelské karty","instructions":"Obrázky pozadí jsou zarovnány a mají výchozí šířku 590px. "},"email":{"title":"Emailová adresa","primary":"Hlavní email","secondary":"Záložní emailové adresy","no_secondary":"Žádné záložní emailové adresy","instructions":"Nikdy nebude zveřejněno.","ok":"Pro potvrzení vám pošleme email.","invalid":"Zadejte prosím správnou emailovou adresu","authenticated":"Vaše emailová adresa byla autorizována přes službu {{provider}}.","frequency_immediately":"Pokud jste obsah dosud nečetli, pošleme vám ho ihned emailem.","frequency":{"one":"Email vám zašleme pouze pokud jste se neukázali během poslední minuty.","few":"Email vám zašleme pouze pokud jste se neukázali během posledních {{count}} minut.","many":"Email vám zašleme pouze pokud jste se neukázali během posledních {{count}} minut.","other":"Email vám zašleme pouze pokud jste se neukázali během posledních {{count}} minut."}},"associated_accounts":{"title":"Propojené účty","connect":"Připojit","revoke":"Odpojit","cancel":"Zrušit","not_connected":"(nepřipojeno)"},"name":{"title":"Jméno","instructions":"vaše celé jméno (nepovinné)","instructions_required":"Vaše celé jméno","too_short":"Máte moc krátké jméno","ok":"Parádní jméno"},"username":{"title":"Uživatelské jméno","instructions":"jedinečné, bez mezer, krátké","short_instructions":"Lidé vás mohou zmínit pomocí @{{username}}","available":"Vaše uživatelské jméno je volné","not_available":"Není k dispozici. Co třeba {{suggestion}}?","not_available_no_suggestion":"Není k dispozici","too_short":"Uživatelské jméno je moc krátké","too_long":"Uživatelské jméno je moc dlouhé","checking":"Zjišťuji, zda je uživatelské jméno volné...","prefilled":"Email je propojen s tímto uživatelským jménem"},"locale":{"title":"Jazyk rozhraní","instructions":"Jazyk uživatelského prostředí. Změna obnoví stránku.","default":"(výchozí)","any":"jakýkoliv"},"password_confirmation":{"title":"Heslo znovu"},"auth_tokens":{"title":"Nedávno použitá zařízení","ip":"IP","details":"Podrobnosti","log_out_all":"Odhlásit všechny","active":"právě aktivní","not_you":"Nejste to vy?","show_all":"Ukázat vše ({{count}})","show_few":"Ukázat méně","was_this_you":"Byla to vaše návštěva?","browser_and_device":"{{browser}} na {{device}}"},"last_posted":"Poslední příspěvek","last_emailed":"Email naposledy zaslán","last_seen":"Naposledy viděn","created":"Účet vytvořen","log_out":"Odhlásit se","location":"Lokace","website":"Webová stránka","email_settings":"Emailová upozornění","hide_profile_and_presence":"Skrýt můj veřejný profil a informace o mé přítomnosti","text_size":{"normal":"Normální"},"like_notification_frequency":{"title":"Upozornit mě na \"to se mi líbí\"","always":"Vždy","first_time_and_daily":"Po prvé a pak každý den","first_time":"Po prvé","never":"Nikdy"},"email_previous_replies":{"title":"Zahrnout předchozí reakce na konci emailů","unless_emailed":"pokud nebyli dříve odeslány","always":"vždy","never":"nikdy"},"email_digests":{"every_30_minutes":"každých 30 minut","every_hour":"každou hodinu","daily":"denně","weekly":"týdně","every_month":"každý měsíc","every_six_months":"každých šest měsíců"},"email_level":{"title":"Zašli mi email, pokud mě někde cituje, odpoví na můj příspěvek, zmíní mé @jméno nebo mě pozve do tématu.","always":"vždy","never":"nikdy"},"email_messages_level":"Zašli mi email, pokud mi někdo pošle zprávu.","include_tl0_in_digests":"Zahrnout obsah nových uživatelů v souhrnných emailech","email_in_reply_to":"Zahrnout v emailech úryvek příspěvku, na který je reagováno","other_settings":"Ostatní","categories_settings":"Kategorie","new_topic_duration":{"label":"Považovat témata za nová, pokud","not_viewed":"jsem je dosud neviděl.","last_here":"byla vytvořena od mé poslední návštěvy.","after_1_day":"vytvořeno během posledního dne","after_2_days":"vytvořeno během posledních 2 dnů","after_1_week":"vytvořeno během posledního týdne","after_2_weeks":"vytvořeno během posledních 2 týdnů"},"auto_track_topics":"Automaticky sledovat témata, která navštívím","auto_track_options":{"never":"nikdy","immediately":"ihned","after_30_seconds":"po 30 sekundách","after_1_minute":"po 1 minutě","after_2_minutes":"po 2 minutách","after_3_minutes":"po 3 minutách","after_4_minutes":"po 4 minutách","after_5_minutes":"po 5 minutách","after_10_minutes":"po 10 minutách"},"notification_level_when_replying":"Když přidám příspěvek k tématu, nastav toto téma na:","invited":{"search":"pište pro hledání v pozvánkách...","title":"Pozvánky","user":"Pozvaný uživatel","none":"Nejsou žádné pozvánky k zobrazení.","truncated":{"one":"Zobrazena první pozvánka.","few":"Zobrazeno prvních {{count}} pozvánek.","many":"Zobrazeno prvních {{count}} pozvánek.","other":"Zobrazeno prvních {{count}} pozvánek."},"redeemed":"Uplatněné pozvánky","redeemed_tab":"Uplatněno","redeemed_tab_with_count":"Vyřízeno ({{count}})","redeemed_at":"Uplatněno","pending":"Nevyřízené pozvánky","pending_tab":"Čeká na schválení","pending_tab_with_count":"Nevyřízeno ({{count}})","topics_entered":"Zobrazil témat","posts_read_count":"Přečteno příspěvků","expired":"Poznávka je už prošlá.","rescind":"Smazat","rescinded":"Pozvánka odstraněna","reinvite":"Znovu poslat pozvánku","reinvite_all":"Znovu poslat všechny pozvánky","reinvite_all_confirm":"Opravdu chcete znovu poslat všechny pozvánky?","reinvited":"Pozvánka byla opětovně odeslána.","reinvited_all":"Všechny pozvánky byly opětovně odeslány!","time_read":"Čas čtení","days_visited":"Přítomen dnů","account_age_days":"Stáří účtu ve dnech","create":"Poslat pozvánku","generate_link":"Zkopírovat odkaz na pozvánku","link_generated":"Odkaz pozvánky byl úspěšně vygenerován!","valid_for":"Odkaz pozvánky je platný pouze pro tuto emailovou adresu: %{email}","bulk_invite":{"none":"Nikoho jste zatím nepozval. Můžete poslat individuální pozvánky, případně \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003enahrát CSV soubor\u003c/a\u003e a pozvat tak několik lidí najednou.","text":"Hromadné pozvání s pomocí souboru","success":"Nahrání souboru proběhlo úspěšně. O dokončení celého procesu budete informování pomocí zprávy.","error":"Omlouváme se, soubor by měl být ve formátu CSV."}},"password":{"title":"Heslo","too_short":"Vaše heslo je příliš krátké.","common":"Toto heslo je používané moc často.","same_as_username":"Vaše heslo je stejné jako Vaše uživatelské jméno.","same_as_email":"Vaše heslo je stejné jako váš e-mail.","ok":"Vaše heslo je v pořádku.","instructions":"alespoň %{count} znaků"},"summary":{"title":"Souhrn","stats":"Statistiky","time_read":"načteno","recent_time_read":"poslední čas čtení","topic_count":{"one":"téma vytvořeno","few":"témata vytvořena","many":"témat vytvořeno","other":"témat vytvořeno"},"post_count":{"one":"příspěvek vytvořen","few":"příspěvky vytvořeny","many":"příspěvků vytvořeno","other":"příspěvků vytvořeno"},"likes_given":{"one":"dán","few":"dány","many":"dáno","other":"dáno"},"likes_received":{"one":"obdržen","few":"obdrženy","many":"obdrženo","other":"obdrženo"},"days_visited":{"one":"den navštíven","few":"dny navštíveno","many":"dní navštíveno","other":"dní navštíveno"},"topics_entered":{"one":"zobrazeno téma","few":"zobrazeny témata","many":"zobrazeno témat","other":"zobrazeno témat"},"posts_read":{"one":"přečten příspěvek","few":"přečteny příspěvky","many":"přečteno příspěvků","other":"přečteno příspěvků"},"bookmark_count":{"one":"záložka","few":"záložky","many":"záložek","other":"záložek"},"top_replies":"Nejnovější příspěvky","no_replies":"Zatím žádné odpovědi.","more_replies":"Více odpovědí","top_topics":"Nejnovější témata","no_topics":"Zatím žádné témata.","more_topics":"Více témat","top_badges":"Nejnovější odznaky","no_badges":"Zatím žádné odznaky.","more_badges":"Více odznaků","top_links":"Nejnovější odkazy","no_links":"Zatím žádné odkazy.","most_liked_by":"Nejvíce \"to se mi líbí\" od uživatele","most_liked_users":"Nejvíce \"to se mi líbí\"","most_replied_to_users":"Nejvíce odpovědí","no_likes":"Zatím žádné \"to se mi líbí\"","top_categories":"Nej kategorie","topics":"Témata","replies":"Odpovědi"},"ip_address":{"title":"Poslední IP adresa"},"registration_ip_address":{"title":"Registrační IP adresa"},"avatar":{"title":"Profilový obrázek","header_title":"profil, zprávy, záložky a nastavení"},"title":{"title":"Titul","none":"(žádný)"},"primary_group":{"title":"Hlavní skupina","none":"(žádný)"},"filters":{"all":"Všechno"},"stream":{"posted_by":"Zaslal","sent_by":"Odeslal","private_message":"zpráva","the_topic":"téma"}},"loading":"Načítám...","errors":{"prev_page":"při nahrávání stránky","reasons":{"network":"Chyba sítě","server":"Chyba serveru","forbidden":"Přístup zamítnut","unknown":"Chyba","not_found":"Stránka nenalezena"},"desc":{"network":"Prosím zkontrolujte své připojení.","network_fixed":"Looks like it's back.","server":"Kód chyby: {{status}}","forbidden":"Nemáte povolení to spatřit.","not_found":"Jejda, aplikace zkusila načíst neexistující URL.","unknown":"Něco se pokazilo."},"buttons":{"back":"Zpět","again":"Zkusit znovu","fixed":"Nahrávám"}},"modal":{"close":"zavřít"},"close":"Zavřít","assets_changed_confirm":"Tento web se právě aktualizoval. Chcete obnovit stránku a mít nejnovější verzi?","logout":"Byli jste odhlášeni.","refresh":"Obnovit","read_only_mode":{"enabled":"Tato stránka je v režimu jen pro čtení. Prosim pokračujte v prohlížení, ale odpovídání a ostatní operace jsou momentálně vypnuté.","login_disabled":"Přihlášení je zakázáno jelikož je stránka v režimu jen pro čtení.","logout_disabled":"Odhlášení je zakázáno zatímco je stránka v režimu jen pro čtení."},"learn_more":"více informací...","all_time":"celkem","all_time_desc":"témat vytvořeno","year":"rok","year_desc":"témata za posledních 365 dní","month":"měsíc","month_desc":"témata za posledních 30 dní","week":"týden","week_desc":"témata za posledních 7 dní","day":"den","first_post":"První příspěvek","mute":"Ignorovat","unmute":"Zrušit ignorování","last_post":"Přispěl","time_read":"Přečteno","time_read_recently":"%{time_read}nedávno","time_read_tooltip":"%{time_read}celkový čas čtení","time_read_recently_tooltip":"%{time_read}celkový čas čtení (%{recent_time_read}za posledních 60 dnů)","last_reply_lowercase":"poslední odpověď","replies_lowercase":{"one":"odpověď","few":"odpovědi","many":"odpovědí","other":"odpovědí"},"signup_cta":{"sign_up":"Registrovat se","hide_session":"Připomenout mi zítra","hide_forever":"děkuji, ne","hidden_for_session":"Dobrá, zeptám se tě zítra. Pro založení účtu můžeš také vždy použít 'Přihlásit se'.","intro":"Zdravíčko! Vypadá to, že si užíváte naše diskuze, ale ještě nemáte vlastní účet.","value_prop":"Pokud si založíš účet, budeme si přesně pamatovat, co jsi četl, takže se vždycky vrátíš do bodu, odkud jsi odešel. Také budeš dostávat upozornění zde a přes e-mail, kdykoli ti někdo odpoví. A můžeš přidávat 'to se mi líbí' a šířit tak lásku. :heartpulse:"},"summary":{"enabled_description":"Čtete shrnutí tohoto tématu: nejzajímavější příspěvky podle komunity.","description":"Je tu \u003cb\u003e{{replyCount}}\u003c/b\u003e odpovědí.","description_time":"Je tu \u003cb\u003e{{replyCount}}\u003c/b\u003e odpovědí o odhadovaném času čtení \u003cb\u003e{{readingTime}} minut\u003c/b\u003e.","enable":"Přepnout na \"nejlepší příspěvky\"","disable":"Přepnout na normální zobrazení"},"deleted_filter":{"enabled_description":"Toto téma obsahuje schované smazané příspěvky.","disabled_description":"Smazané příspěvky v tomto tématu jsou zobrazeny.","enable":"Schovat smazané příspěvky","disable":"Zobrazit smazané příspěvky"},"private_message_info":{"title":"Zpráva","invite":"Pozvat další...","edit":"Přidat nebo odebrat...","leave_message":"Opravdu chcete opustit tuto zprávu?","remove_allowed_user":"Určitě chcete odstranit {{name}} z této zprávy?","remove_allowed_group":"Opravdu chcete odstranit {{name}} z této zprávy?"},"email":"Email","username":"Uživatelské jméno","last_seen":"Naposledy viděn","created":"Vytvořeno","created_lowercase":"vytvořeno","trust_level":"Důvěryhodnost","search_hint":"uživatelské jméno, email nebo IP adresa","create_account":{"title":"Vytvořit nový účet","failed":"Něco se nepovedlo, možná je tato e-mailová adresa již použita. Zkuste použít formulář pro obnovení hesla."},"forgot_password":{"title":"Obnovení hesla","action":"Zapomněl jsem své heslo","invite":"Vložte svoje uživatelské jméno nebo e-mailovou adresu a my vám zašleme postup pro obnovení hesla.","reset":"Resetovat heslo","complete_username":"Pokud nějaký účet odpovídá uživatelskému jménu \u003cb\u003e%{username}\u003c/b\u003e, obdržíte záhy email s instrukcemi jak dál postupovat v resetování hesla.","complete_email":"Pokud nějaký účet odpovídá emailu \u003cb\u003e%{email}\u003c/b\u003e, obdržíte záhy email s instrukcemi jak dál postupovat v resetování hesla.","complete_username_not_found":"Nebyl nalezen účet s uživatelským jménem \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nebyl nalezen účet s odpovídající emailu \u003cb\u003e%{email}\u003c/b\u003e","help":"Nepříšel email? Nezapomeňte nejprve zkontrolovat složku spam. \u003cp\u003eNevíte, kterou e-mailovou adresu jste použili? Zadejte e-mailovou adresu a my vás budeme informovat, pokud zde existuje.\u003c/p\u003e \u003cp\u003ePokud již nemáte přístup k e-mailové adrese ve vašem účtu, kontaktujte prosím \u003ca href='%{basePath}/about'\u003enaši ochotnou redakci\u003c/a\u003e\u003c/p\u003e.","button_ok":"OK","button_help":"Nápověda"},"email_login":{"link_label":"Chci odkaz na login do emailu","button_label":"přes email","complete_username":"Pokud je tu účet, který používá uživatelské jméno \u003cb\u003e%{username}\u003c/b\u003e, měl by vám za chvilku přijít email s přihlašovacím odkazem.","complete_email":"Pokud je tu účet s emailovou adresou \u003cb\u003e%{email}\u003c/b\u003e, měl by vám za chvilku přijít email s přihlašovacím odkazem.","complete_username_found":"Našli jsme účet s uživatelským jménem \u003cb\u003e%{username}\u003c/b\u003e, za chvilku by měl přijít email s přihlašovacím odkazem.","complete_email_found":"Našli jsme účet s emailovou adresou \u003cb\u003e%{email}\u003c/b\u003e, za chvilku by měl přijít email s přihlašovacím odkazem.","complete_username_not_found":"Nebyl nalezen účet s uživatelským jménem \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"Nebyl nalezen účet s emailem \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Pokračovat na %{site_name}"},"login":{"title":"Přihlásit se","username":"Uživatel","password":"Heslo","second_factor_title":"Dvoufázové přihlašování","second_factor_description":"Prosím zadejte autentikační kód z vaší aplikace:","second_factor_backup_title":"Dvoufaktorová autentizace","second_factor_backup_description":"Prosíme zadejte jeden ze svých záložních kódů:","email_placeholder":"emailová adresa nebo uživatelské jméno","caps_lock_warning":"zapnutý Caps Lock","error":"Neznámá chyba","rate_limit":"Počkejte před dalším pokusem se přihlásit.","blank_username":"Zadejte vaši emailovou adresu a uživatelské jméno.","blank_username_or_password":"Vyplňte prosím email nebo uživatelské jméno, a heslo.","reset_password":"Resetovat heslo","logging_in":"Přihlašuji...","or":"Nebo","authenticating":"Autorizuji...","awaiting_activation":"Váš účet nyní čeká na aktivaci, použijte odkaz pro zapomenuté heslo, jestli chcete, abychom vám zaslali další aktivační email.","awaiting_approval":"Váš účet zatím nebyl schválen členem redakce. Až se tak stane, budeme vás informovat emailem.","requires_invite":"Promiňte, toto fórum je pouze pro zvané.","not_activated":"Ještě se nemůžete přihlásit. Zaslali jsme vám aktivační email v \u003cb\u003e{{sentTo}}\u003c/b\u003e. Prosím následujte instrukce v tomto emailu, abychom mohli váš účet aktivovat.","not_allowed_from_ip_address":"Z této IP adresy se nemůžete přihlásit.","admin_not_allowed_from_ip_address":"Z této IP adresy se nemůžete přihlásit jako administrátor.","resend_activation_email":"Klikněte sem pro zaslání aktivačního emailu.","omniauth_disallow_totp":"Váš účet má zapnutou dvoufaktorovou autentizaci. Prosíme přihlašte se napřed svým heslem.","resend_title":"Znovu odeslat aktivační email","change_email":"Změnit emailovou adresu","provide_new_email":"Zadejte novou adresu na kterou chcete zaslat potvrzovací email.","submit_new_email":"Aktualizovat emailovou adresu","sent_activation_email_again":"Zaslali jsme vám další aktivační email na \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Může trvat několik minut, než vám dorazí. Zkontrolujte také vaši složku s nevyžádanou pošlou.","to_continue":"Přihlaš se, prosím","preferences":"Pro to, aby jsi mohl měnit své uživatelské nastavení, se musíš přihlásit.","forgot":"Nevybavuju si podrobnosti svého účtu","not_approved":"Váš účet zatím nebyl schválen. Až se tak stane, obdržíte oznámení emailem a budete se moci přihlásit.","google_oauth2":{"name":"Google","title":"přes Google"},"twitter":{"name":"Twitter","title":"přes Twitter"},"instagram":{"name":"Instagram","title":"s Instagramem"},"facebook":{"name":"Facebook","title":"přes Facebook"},"github":{"name":"GitHub","title":"přes GitHub"},"discord":{"name":"Discord"}},"invites":{"accept_title":"Pozvání","welcome_to":"Vítejte na %{site_name}!","invited_by":"Pozvání od:","social_login_available":"Budete se moci také přihlásit pomocí libovolné sociální sítě používající tento email.","your_email":"Emailová adresa vašeho účtu je \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Přijmout pozvání","success":"Váš účet byl vytvořen a nyní jste přihlášeni.","name_label":"Jméno","password_label":"Nastavit heslo","optional_description":"(volitelné)"},"password_reset":{"continue":"Pokračovat na %{site_name}"},"emoji_set":{"apple_international":"Apple/Mezinárodní","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Pouze kategorie","categories_with_featured_topics":"Kategorie a vybrané příspěvky","categories_and_latest_topics":"Kategorie a nejnovější témata","categories_and_top_topics":"Kategorie a populární témata","categories_boxes":"Boxy s podkategoriemi","categories_boxes_with_topics":"Boxy s vybranými tématy"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"Načítá se..."},"select_kit":{"default_header_text":"Vybrat…","no_content":"Nebyly nalezeny žádné výsledky","filter_placeholder":"Hledat...","filter_placeholder_with_any":"Vyhledat nebo vytvořit...","create":"Vytvořit: '{{content}}'","max_content_reached":{"one":"Můžete vybrat jen {{count}} položku.","few":"Můžete vybrat jen {{count}} položky.","many":"Můžete vybrat pouze {{count}} položek.","other":"Můžete vybrat jen {{count}} položek."},"min_content_not_reached":{"one":"Vyberte nejméně {{count}} položku.","few":"Vyberte nejméně {{count}} položky.","many":"Vyberte nejméně {{count}} položek.","other":"Vyberte nejméně {{count}} položek."}},"date_time_picker":{"from":"Od koho","to":"Komu"},"emoji_picker":{"filter_placeholder":"Hledat emoji","objects":"Objekty","flags":"Nahlášení","recent":"Nedávno použité","default_tone":"Bez barvy pleti","light_tone":"Světlá pleť","medium_light_tone":"Krémově světlá pleť","medium_tone":"Mírně hnědá pleť","medium_dark_tone":"Hnědá pleť","dark_tone":"Černá pleť","default":"Vlastní emoji"},"shared_drafts":{"title":"Sdílené koncepty","notice":"Toto téma uvidí pouze uživatelé, kteří mohou vidět kategorii \u003cb\u003e{{category}}\u003c/b\u003e","destination_category":"Cílová kategorie","publish":"Zveřejnit sdílený koncept","confirm_publish":"Určitě chceš zveřejnit tento koncept?","publishing":"Zveřejňuji téma..."},"composer":{"emoji":"Smajlíky :)","more_emoji":"více...","options":"Možnosti","whisper":"šeptat","unlist":"neviditelné","blockquote_text":"Bloková citace","add_warning":"Toto je oficiální varování.","toggle_whisper":"Přepnout šeptání","toggle_unlisted":"Přepnout neviditelné","posting_not_on_topic":"Rozepsali jste odpověď na téma \"{{title}}\", ale nyní máte otevřené jiné téma.","saved_local_draft_tip":"uloženo lokálně","similar_topics":"Podobná témata","drafts_offline":"koncepty offline","group_mentioned_limit":"\u003cb\u003eVarování!\u003c/b\u003e Zmínili jste \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, ale protože má tato skupina více členů než je administrátorem nastavený limit maximálního počtu {{max}} uživatelů, kteří mohou být informováni, nebude informován nikdo.","group_mentioned":{"one":"Zmíněním {{group}}, upozorníš \u003ca href='{{group_link}}'\u003e%{count} člověka\u003c/a\u003e – jste si jistý/á?","few":"Zmíněním {{group}}, upozorníš \u003ca href='{{group_link}}'\u003e{{count}} lidi\u003c/a\u003e – jste si jistý/á?","many":"Zmíněním {{group}}, upozorníš \u003ca href='{{group_link}}'\u003e{{count}} lidí\u003c/a\u003e – jste si jistý/á?","other":"Zmíněním {{group}}, upozorníš \u003ca href='{{group_link}}'\u003e{{count}} lidí\u003c/a\u003e – jste si jistý/á?"},"cannot_see_mention":{"category":"Zmínili jste uživatele {{username}}, ale oznámení se mu nepošle, protože nemá přístup do této kategorie. Budete jej muset přidat do skupiny, která má přístup do této kategorie.","private":"Zmínili jste uživatele {{username}}, ale oznámení se mu nepošle, protože tuto osobní zprávu nevidí. Musíte ho pozvat do této osobní konverzace."},"duplicate_link":"Zdá se, že odkaz na \u003cb\u003e{{domain}}\u003c/b\u003e už uvedl v tomto tématu \u003cb\u003e@ {{username}}\u003c/b\u003e v \u003ca href='{{post_url}}'\u003eodpovědi {{ago}}\u003c/a\u003e - opravdu chcete odkaz poslat znovu?","error":{"title_missing":"Název musí být vyplněn","title_too_short":"Název musí být dlouhý alespoň {{min}} znaků","title_too_long":"Název nemůže být delší než {{max}} znaků","post_length":"Příspěvek musí být alespoň {{min}} znaků dlouhý","category_missing":"Musíte vybrat kategorii","tags_missing":"Vybraných tagů musí být nejméně {{count}}"},"save_edit":"Uložit změnu","overwrite_edit":"Přepsat úpravu","reply_original":"Odpovědět na původní téma","reply_here":"Odpovědět sem","reply":"Odpovědět","cancel":"Zrušit","create_topic":"Vytvořit téma","create_pm":"Zpráva","create_whisper":"Šeptat","create_shared_draft":"Vytvořit sdílený koncept","edit_shared_draft":"Upravit sdílený koncept","title":"Nebo zmáčkněte Ctrl+Enter","users_placeholder":"Přidat uživatele","title_placeholder":"O čem je ve zkratce tato diskuze?","title_or_link_placeholder":"Sem vložte název téma","edit_reason_placeholder":"proč byla nutná úprava?","topic_featured_link_placeholder":"Zadej odkaz ukázaný názvem","remove_featured_link":"Odstranit odkaz z tématu.","reply_placeholder":"Pište sem. Můžete použít Markdown, BBCode nebo HTML. Obrázky nahrajte přetáhnutím nebo vložením ze schránky.","reply_placeholder_no_images":"Pište sem. Můžete použít Markdown, BBCode nebo HTML.","view_new_post":"Zobrazit váš nový příspěvek.","saving":"Ukládám","saved":"Uloženo!","uploading":"Nahrávám...","show_preview":"zobrazit náhled \u0026raquo;","hide_preview":"\u0026laquo; skrýt náhled","quote_post_title":"Citovat celý příspěvek","bold_label":"B","bold_title":"Tučně","bold_text":"tučný text","italic_label":"I","italic_title":"Kurzíva","italic_text":"text kurzívou","link_title":"Odkazy","link_description":"sem vložte popis odkazu","link_dialog_title":"Vložit odkaz","link_optional_text":"volitelný popis","quote_title":"Bloková citace","quote_text":"Bloková citace","code_title":"Ukázka kódu","code_text":"odsadit předformátovaný text o 4 mezery","paste_code_text":"napište nebo vložte kód tady","upload_title":"Obrázek","upload_description":"sem vložek popis obrázku","olist_title":"Číslovaný seznam","ulist_title":"Odrážkový seznam","list_item":"Položka seznam","toggle_direction":"Přepnout směr","help":"Nápověda pro Markdown","collapse":"minimalizovat panel editoru","abandon":"zavřít editor a zahodit koncept","enter_fullscreen":"otevřít editor na celou obrazovku","exit_fullscreen":"opustit editor na celou obrazovku","modal_ok":"OK","modal_cancel":"Zrušit","cant_send_pm":"Bohužel, nemůžete poslat zprávu uživateli %{username}.","yourself_confirm":{"title":"Zapomněl/a jste přidat přijemce?","body":"Nyní tuto zprávu posíláte pouze sám/sama sobě!"},"admin_options_title":"Volitelné redakční nastavení tématu","composer_actions":{"reply":"Odpověď","draft":"Koncept","edit":"Upravit","reply_to_post":{"label":"Odpovědět na příspěvek %{postNumber} od %{postUsername}","desc":"Odpovědět na konkrétní příspěvek"},"reply_as_new_topic":{"label":"Odpovědět v propojeném tématu","desc":"Vytvořit nové téma propojené s tímto tématem"},"reply_as_private_message":{"label":"Nová zpráva","desc":"Vytvořit novou osobní zprávu"},"reply_to_topic":{"label":"Odpovědět na téma","desc":"Odpovědět na téma, ale ne na konkrétní příspěvek"},"toggle_whisper":{"label":"Přepnout šeptání","desc":"Šeptání vidí pouze redaktoři"},"create_topic":{"label":"Nové téma"},"shared_draft":{"label":"Sdílený koncept","desc":"Navrhnout téma, které uvidí pouze redakce"},"toggle_topic_bump":{"label":"Přepnout zvýraznění tématu","desc":"Odpovědět bez ovlivnění data poslední odpovědi"}},"details_title":"Souhrn","details_text":"Tento text bude skrytý"},"notifications":{"tooltip":{"regular":{"one":"%{count} nepřečtene upozornění","few":"{{count}} nepřečtená upozornění","many":"{{count}} nepřečtených upozornění","other":"{{count}} nepřečtených upozornění"},"message":{"one":"%{count} nepřečtená zpráva","few":"{{count}} nepřečtené zprávy","many":"{{count}} nepřečtených zpráv","other":"{{count}} nepřečtených zpráv"}},"title":"oznámení o zmínkách pomocí @name, odpovědi na vaše příspěvky a témata, zprávy, atd.","none":"Notifikace nebylo možné načíst.","empty":"Žádné upozornění nenalezeny.","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} a %{count} další\u003c/span\u003e {{description}}","few":"\u003cspan\u003e{{username}}, {{username2}} a {{count}} další\u003c/span\u003e {{description}}","many":"\u003cspan\u003e{{username}}, {{username2}} a {{count}} dalších\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} a {{count}} dalších\u003c/span\u003e {{description}}"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e přijal vaše pozvání","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e přesunul {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Získáno '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eNové téma\u003c/span\u003e {{description}}","group_message_summary":{"one":"{{count}} zpráva ve schránce skupiny {{group_name}}","few":"{{count}} zprávy ve schránce skupiny {{group_name}}","many":"{{count}} zpráv ve schránce skupiny {{group_name}}","other":"{{count}} zpráv ve schránce skupiny {{group_name}}"},"popup":{"mentioned":"{{username}} vás zmínil v \"{{topic}}\" - {{site_title}}","group_mentioned":"Uživatel {{username}} vás zmínil v \"{{topic}}\" - {{site_title}}","quoted":"{{username}} vás citoval v \"{{topic}}\" - {{site_title}}","replied":"{{username}} vám odpověděl v \"{{topic}}\" - {{site_title}}","posted":"{{username}} přispěl do \"{{topic}}\" - {{site_title}}","private_message":"{{username}} vám poslal soukromou zprávu v \"{{topic}}\" - {{site_title}}","linked":"{{username}} odkázal na vás příspěvek v \"{{topic}}\" - {{site_title}}","confirm_title":"Upozornění zapnuta - %{site_title}","confirm_body":"Upozornění úspěšně zapnuta."},"titles":{"watching_first_post":"nové téma"}},"upload_selector":{"title":"Vložit obrázek","title_with_attachments":"Nahrát obrázek nebo soubor","from_my_computer":"Z mého zařízení","from_the_web":"Z webu","remote_tip":"odkaz na obrázek","remote_tip_with_attachments":"odkaz na obrázek nebo soubor {{authorized_extensions}}","local_tip":"vyber obrázky z tvého zařízení","local_tip_with_attachments":"vyber obrázky nebo soubory ze svého zařízení {{authorized_extensions}}","hint":"(můžete také rovnou soubor do editoru přetáhnout)","hint_for_supported_browsers":"také můžeš obrázky do editoru přetáhnout nebo vložit","uploading":"Nahrávám","select_file":"Vyberte soubor","default_image_alt_text":"obrázek"},"search":{"sort_by":"Seřadil","relevance":"Relevance","latest_post":"Poslední příspěvek","latest_topic":"Nejnovější téma","most_viewed":"Nejzobrazovanější","most_liked":"Nejoblíbenější","select_all":"Vybrat vše","clear_all":"Vymazat vše","too_short":"Hledaný výraz je příliš krátký.","result_count":{"one":"\u003cspan\u003e%{count} výsledek pro\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","few":"\u003cspan\u003e{{count}}{{plus}} výsledky pro\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","many":"\u003cspan\u003e{{count}}{{plus}} výsledků pro\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} výsledků pro\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"vyhledávat témata, příspěvky, uživatele nebo kategorie","full_page_title":"vyhledávat témata nebo příspěvky","no_results":"Nenalezeny žádné výsledky.","no_more_results":"Nenalezeny žádné další výsledky.","searching":"Hledám ...","post_format":"#{{post_number}} od {{username}}","results_page":"Výsledky hledání pro '{{term}}'","more_results":"Existuje více výsledků. Prosím zpřesněte kritéria vyhledávání.","cant_find":"Nemůžete najít, co hledáte?","start_new_topic":"Možná vytvořte nové téma?","or_search_google":"Nebo zkuste vyhledávat pomocí Google:","search_google":"Zkuste vyhledávat pomocí Google:","search_google_button":"Google","search_google_title":"Hledat na tomto webu","context":{"user":"Vyhledat příspěvky od @{{username}}","category":"Hledat v kategorii #{{category}}","topic":"Vyhledat v tomto tématu","private_messages":"Hledat ve zprávách"},"advanced":{"title":"Pokročilé hledání","posted_by":{"label":"Od uživatele"},"in_category":{"label":"V kategorii"},"in_group":{"label":"Ve skupině"},"with_badge":{"label":"S odznakem"},"with_tags":{"label":"Se štítkem"},"filters":{"label":"Pouze v tématech/příspěvcích, které","title":"Hledat jen v nadpisu","likes":"se mi líbí","posted":"Přidal jsem příspěvek","watching":"Sleduji","tracking":"Sleduji.","private":"v mých zprávách","bookmarks":"Mám v záložkách","first":"jsou první příspěvek v tématu","pinned":"jsou připnuty","unpinned":"nejsou připnuty","seen":"která jsem četl","unseen":"jsem nečetl","wiki":"jsou wiki","images":"včetně obrázků","all_tags":"Všechny uvedené štítky"},"statuses":{"label":"Kde příspěvky","open":"jsou otevřeny","closed":"jsou zavřeny","archived":"jsou archivovány","noreplies":"jsou bez odpovědi","single_user":"obsahují jen jednoho uživatele"},"post":{"count":{"label":"Minimální počet příspěvků"},"time":{"label":"Přidáno","before":"před","after":"po"}}}},"hamburger_menu":"jít na jiný seznam témat nebo kategorii","new_item":"nové","go_back":"jít zpět","not_logged_in_user":"stránka uživatele s přehledem o aktuální činnosti a nastavení","current_user":"jít na vaši uživatelskou stránku","topics":{"new_messages_marker":"poslední návštěva","bulk":{"select_all":"Vybrat vše","clear_all":"Zrušit vše","unlist_topics":"Odebrat témata ze seznamu","relist_topics":"Znovunačíst seznam témat","reset_read":"reset přečteného","delete":"Smazat témata","dismiss":"Označit jako přečtené","dismiss_read":"Označit všechno nepřečtené jako přečtené","dismiss_button":"Označit jako přečtené...","dismiss_tooltip":"Označit jako přečtené jen nové příspěvky nebo přestat sledovat témata","also_dismiss_topics":"Přestat sledovat tyto témata, takže se mi znovu nezobrazí jako nepřečtená","dismiss_new":"Označit jako přečtené vše nové","toggle":"hromadný výběr témat","actions":"Hromadné akce","change_category":"Nastavit kategorii","close_topics":"Zavřít téma","archive_topics":"Archivovat témata","notification_level":"Upozornění","choose_new_category":"Zvolte novou kategorii pro témata:","selected":{"one":"Vybrali jste \u003cb\u003e%{count}\u003c/b\u003e téma.","few":"Vybrali jste \u003cb\u003e{{count}}\u003c/b\u003e témata.","many":"Vybrali jste \u003cb\u003e{{count}}\u003c/b\u003e témat.","other":"Vybrali jste \u003cb\u003e{{count}}\u003c/b\u003e témat."},"change_tags":"Zaměnit štítky","append_tags":"Přidat štítky","choose_new_tags":"Zvolte nové tagy pro témata:","choose_append_tags":"Zvolte nové tagy, které se mají přiřadit k těmto tématům:","changed_tags":"Tagy témat byly změněny."},"none":{"unread":"Nemáte žádná nepřečtená témata.","new":"Nemáte žádná nová témata ke čtení.","read":"Zatím jste nečetli žádná témata.","posted":"Zatím jste nepřispěli do žádného tématu.","latest":"Nejsou tu žádná témata z poslední doby. To je docela smutné.","bookmarks":"V tématech nemáte žádné záložky.","category":"V kategorii {{category}} nejsou žádná témata.","top":"Nejsou tu žádná populární témata.","educate":{"new":"\u003cp\u003eZde se zobrazují vaše nová témata.\u003c/p\u003e\u003cp\u003eDle výchozího nastavení se za nové příspěvky, které budou mít štítek\u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enové\u003c/span\u003e , považují příspěvky, které byly vytvořeny během posledních 2 dnů.\u003c/p\u003e\u003cp\u003eToto můžete změnit ve svém \u003ca href=\"%{userPrefsUrl}\"\u003enastavení\u003c/a\u003e.\u003c/p\u003e","unread":"\u003cp\u003eZde se zobrazují vaše nepřečtená témata.\u003c/p\u003e\u003cp\u003ePodle výchozího nastavení jsou za nepřečtená témata, u kterých se zobrazuje počet nepřečtení \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e, považována ta, která jste:\u003c/p\u003e\u003cul\u003e\u003cli\u003eVytvořil toto téma\u003c/li\u003e\u003cli\u003eOdpověděli v tématu\u003c/li\u003e\u003cli\u003eČetl téma více než 4 minuty\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eNebo pokud jste nastavil téma jako Hlídané či Sledované pomocí nabídky na spodu každého tématu.\u003c/p\u003e\u003cp\u003eToto chování můžete změnit v \u003ca href=\"%{userPrefsUrl}\"\u003enastavení\u003c/a\u003e.\u003c/p\u003e"}},"bottom":{"latest":"Nejsou tu žádná další témata z poslední doby.","posted":"Nejsou tu žádná další zaslaná témata k přečtení.","read":"Nejsou tu žádná další přečtená témata.","new":"Nejsou tu žádná další nová témata k přečtení.","unread":"Nejsou tu žádná další nepřečtená témata.","category":"V kategorii {{category}} nejsou žádná další témata.","top":"Nejsou tu žádná další populární témata.","bookmarks":"Žádná další oblíbená témata nejsou k dispozici."}},"topic":{"filter_to":{"one":"%{count} příspěvek v tématu","few":"{{count}} příspěvky v tématu","many":"{{count}} příspěvků v tématu","other":"{{count}} příspěvků v tématu"},"create":"Nové téma","create_long":"Vytvořit nové téma","open_draft":"Otevřít koncept","private_message":"Vytvořit zprávu","archive_message":{"help":"Přesunout zprávy do archívu","title":"Archív"},"move_to_inbox":{"title":"Přesunout do Přijaté","help":"Přesunout zprávu zpět do Přijaté"},"edit_message":{"help":"Upravit první příspěvek zprávy","title":"upravit zprávu"},"defer":{"title":"Odložit"},"list":"Témata","new":"nové téma","unread":"nepřečtený","new_topics":{"one":"%{count} nové téma","few":"{{count}} nová témata","many":"{{count}} nových témat","other":"{{count}} nových témat"},"unread_topics":{"one":"%{count} nepřečtené téma","few":"{{count}} nepřečtená témata","many":"{{count}} nepřečtených témat","other":"{{count}} nepřečtených témat"},"title":"Téma","invalid_access":{"title":"Téma je soukromé","description":"Bohužel nemáte přístup k tomuto tématu.","login_required":"Musíte se přihlásit, abyste viděli toto téma."},"server_error":{"title":"Téma se nepodařilo načíst","description":"Bohužel není možné načíst toto téma, může to být způsobeno problémem s vaším připojením. Prosím, zkuste stránku načíst znovu. Pokud bude problém přetrvávat, dejte nám vědět."},"not_found":{"title":"Téma nenalezeno","description":"Bohužel se nám nepovedlo najít toto téma. Nebylo odstraněno moderátorem?"},"total_unread_posts":{"one":"máte %{count} nepřečtený příspěvek v tomto tématu","few":"máte {{count}} nepřečtené příspěvky v tomto tématu.","many":"máte {{count}} nepřečtených příspěvků v tomto tématu.","other":"máte {{count}} nepřečtených příspěvků v tomto tématu."},"unread_posts":{"one":"máte %{count} nepřečtený příspěvěk v tomto tématu","few":"máte {{count}} nepřečtené příspěvky v tomto tématu","many":"máte {{count}} nepřečtených příspěvků v tomto tématu","other":"máte {{count}} nepřečtených příspěvků v tomto tématu"},"new_posts":{"one":"je zde %{count} nový příspěvek od doby, kdy jste toto téma naposledy četli","few":"jsou zde {{count}} nové příspěvky od doby, kdy jste toto téma naposledy četli","many":"je zde {{count}} nových příspěvků od doby, kdy jste toto téma naposledy četli","other":"je zde {{count}} nových příspěvků od doby, kdy jste toto téma naposledy četli"},"likes":{"one":"v tomto tématu je jedno 'líbí se'","few":"v tomto tématu tématu je {{count}} 'líbí se'","many":"v tomto tématu tématu je {{count}} 'líbí se'","other":"v tomto tématu tématu je {{count}} 'líbí se'"},"back_to_list":"Zpátky na seznam témat","options":"Možnosti","show_links":"zobrazit odkazy v tomto tématu","toggle_information":"zobrazit/skrýt detaily tématu","read_more_in_category":"Chcete si toho přečíst víc? Projděte si témata v {{catLink}} nebo {{latestLink}}.","read_more":"Chcete si přečíst další informace? {{catLink}} nebo {{latestLink}}.","browse_all_categories":"Projděte všechny kategorie","view_latest_topics":"zobrazte si populární témata","suggest_create_topic":"Co takhle založit nové téma?","jump_reply_up":"přejít na předchozí odpověď","jump_reply_down":"přejít na následující odpověď","deleted":"Téma bylo smazáno","topic_status_update":{"title":"Časovač tématu","save":"Nastavit časovač ","num_of_hours":"Počet hodin:","remove":"Odstranit časovač","publish_to":"Publikovat v:","when":"Když:","public_timer_types":"Časovače tématu ","private_timer_types":"uživatelské časovače témat"},"auto_update_input":{"none":"Vyberte časové období","later_today":"Později během dnešního dne","tomorrow":"Zítra","later_this_week":"Později během tohoto týdne","this_weekend":"Tento týden","next_week":"Další týden","two_weeks":"Dva týdny","next_month":"Další měsíc","three_months":"Tři měsíce","six_months":"Šest měsíců","one_year":"Jeden rok","forever":"Navždy","pick_date_and_time":"Vyberte datum a čas","set_based_on_last_post":"Zavřít na základě posledního příspěvku"},"publish_to_category":{"title":"Naplánovat publikování"},"temp_open":{"title":"Otevřít dočasně"},"auto_reopen":{"title":"Automaticky otevřít téma"},"temp_close":{"title":"Zavřít dočasně"},"auto_close":{"title":"Automaticky zavřít téma","label":"Automaticky zavřít téma za:","error":"Prosím zadejte platnou hodnotu.","based_on_last_post":"Neuzavírejte téma dokud poslední příspěvek v tomto tématu není alespoň takto starý."},"auto_delete":{"title":"automaticky smazat téma"},"reminder":{"title":"Připomeň mi"},"status_update_notice":{"auto_open":"Toto téma se automaticky otevře %{timeLeft}.","auto_close":"Toto téma se automaticky zavře %{timeLeft}.","auto_publish_to_category":"Toto téma bude zveřejněno v \u003ca href=%{categoryUrl}\u003e%{categoryName}\u003c/a\u003e%{timeLeft}# .","auto_close_based_on_last_post":"Toto téma se zavře %{duration} po poslední odpovědi.","auto_delete":"Toto téma bude automaticky smazáno %{timeLeft}.","auto_reminder":"Toto téma ti připomeneme %{timeLeft}."},"auto_close_title":"Nastavení automatického zavření","auto_close_immediate":{"one":"Poslední příspěvek v témetu je již %{count} hodinu starý, takže toto téma bude okamžitě uzavřeno.","few":"Poslední příspěvek v témetu je již %{count} hodiny starý, takže toto téma bude okamžitě uzavřeno.","many":"Poslední příspěvek v témetu je již %{count} hodin starý, takže toto téma bude okamžitě uzavřeno.","other":"Poslední příspěvek v témetu je již %{count} hodin starý, takže toto téma bude okamžitě uzavřeno."},"timeline":{"back":"Zpět","back_description":"Přejít na poslední nepřečtený příspěvek","replies_short":"%{current} / %{total}"},"progress":{"title":"pozice v tématu","go_top":"nahoru","go_bottom":"dolů","go":"go","jump_bottom":"na poslední příspěvek","jump_prompt":"přejít na...","jump_prompt_of":"%{count} příspěvků","jump_bottom_with_number":"Skočit na příspěvěk %{post_number}","jump_prompt_to_date":"do data","jump_prompt_or":"nebo","total":"celkem příspěvků","current":"aktuální příspěvek"},"notifications":{"title":"změňte, jak často budete upozornění na toto téma","reasons":{"mailing_list_mode":"Máš povolený mailový seznam, takže budeš upozorňován na odpovědi k tomuto tématu přes e.mail.","3_10":"Budete dostávat oznámení, protože hlídáte štítek na tomto tématu.","3_6":"Budete dostávat oznámení, protože hlídáte tuhle kategorii.","3_5":"Budete dostávat oznámení, protože jste tohle téma automaticky začali hlídat.","3_2":"Budete dostávat oznámení, protože hlídáte toto téma.","3_1":"Budete dostávat oznámení, protože jste autorem totoho tématu.","3":"Budete dostávat oznámení, protože hlídáte toto téma.","2_8":"Uvidíte počet nových odpovědí, jelikož sledujete tuto kategorii.","2_4":"Uvidíte počet nových odpovědí, jelikož jste přispěli do tohoto tématu.","2_2":"Uvidíte počet nových odpovědí, jelikož sledujete toto téma.","2":"Uvidíte počet nových odpovědí, protože \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003ejste četl(a) toto téma\u003c/a\u003e.","1_2":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek.","1":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek.","0_7":"Ignorujete všechna oznámení v této kategorii.","0_2":"Ignorujete všechna oznámení z tohoto tématu.","0":"Ignorujete všechna oznámení z tohoto tématu."},"watching_pm":{"title":"Hlídání","description":"Budete informováni o každém novém příspěvku v této zprávě. Vedle názvu tématu se objeví počet nepřečtených příspěvků."},"watching":{"title":"Hlídané","description":"Budete informováni o každém novém příspěvku v tomto tématu. Vedle názvu tématu se objeví počet nepřečtených příspěvků."},"tracking_pm":{"title":"Sledování","description":"U této zprávy se zobrazí počet nových příspěvků. Budete upozorněni, pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"tracking":{"title":"Sledované","description":"U tohoto tématu se zobrazí počet nových příspěvků. Budete upozorněni, pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"regular":{"title":"Normální","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"regular_pm":{"title":"Normální","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"muted_pm":{"title":"Ztišení","description":"Nikdy nedostanete oznámení týkající se čehokoliv v této zprávě."},"muted":{"title":"Ztišené","description":"Nikdy nedostanete nic ohledně tohoto tématu a nezobrazí se v aktuálních."}},"actions":{"title":"Akce","recover":"Vrátit téma","delete":"Odstranit téma","open":"Otevřít téma","close":"Zavřít téma","multi_select":"Vybrat příspěvky…","timed_update":"Nastavit časovač tématu...","pin":"Připevnit téma","unpin":"Odstranit připevnění","unarchive":"Navrátit z archivu","archive":"Archivovat téma","invisible":"Zneviditelnit","visible":"Zviditelnit","reset_read":"Vynulovat počet čtení","make_public":"Vytvořit Veřejné Téma","make_private":"Vytvořit soukromou zprávu ","reset_bump_date":"Resetovat datum zvýraznění"},"feature":{"pin":"Připevnit téma","unpin":"Odstranit připevnění","pin_globally":"Připnout téma globálně","make_banner":"Banner Topic","remove_banner":"Remove Banner Topic"},"reply":{"title":"Odpovědět","help":"Začít psát odpověď na toto téma"},"clear_pin":{"title":"Odstranit připnutí","help":"Odebere připnutí tohoto tématu, takže se již nebude zobrazovat na vrcholu seznamu témat"},"share":{"title":"Sdílet","help":"sdílet odkaz na toto téma"},"print":{"title":"Tisk","help":"Otevři verzi tématu určenou k tisku"},"flag_topic":{"title":"Nahlásit","help":"Soukromě nahlásit tento příspěvek moderátorům","success_message":"Téma úspěšně nahlášeno."},"feature_topic":{"title":"Povýšit téma","pin":"Zobrazit toto téma na vrcholu kategorie {{categoryLink}} dokud","confirm_pin":"Již máte {{count}} připevněných příspěvků. Příliš mnoho připevněných příspěvků může zatěžovat nové nebo anonymní uživatele. Určitě chcete připevnit další téma v této kategorii?","unpin":"Odstranit toto téma z vrcholu {{categoryLink}} kategorie.","unpin_until":"Odstranit toto téma z vrcholu kategorie {{categoryLink}}, nebo počkat dokud \u003cstrong\u003e%{until}\u003c/strong\u003e","pin_note":"Uživatelé mohou odepnout téma sami pro sebe.","pin_validation":"Pro připíchnutí tohoto tématu je třeba datum.","not_pinned":"V kategorii {{categoryLink}} nejsou žádná připnutá témata.","already_pinned":{"one":"Připevněné téma v {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","few":"Připevněná témata v {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"Připevněná témata v {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"Připevněná témata v {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Zobrazit toto téma na vrcholu seznamu všech témat dokud","confirm_pin_globally":"Již máte {{count}} globálně připevněných příspěvků. Příliš mnoho připevněných příspěvků může zatěžovat nové nebo anonymní uživatele. Určitě chcete připevnit další téma globálně?","unpin_globally":"Odstranit toto téma z vrcholu všech seznamů s tématy.","unpin_globally_until":"Odstranit toto téma z vrcholu seznamu všech témat nebo počat dokud \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Uživatelé mohou odepnout téma sami pro sebe.","not_pinned_globally":"Nemáte žádná globálně připevněná témata.","already_pinned_globally":{"one":"V současnosti globálně připevněná témata: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","few":"V současnosti globálně připevněná témata: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"V současnosti globálně připevněná témata: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"V současnosti globálně připevněná témata: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Udělat z tohoto tématu banner, který se zobrazí na vrcholu všech stránek.","remove_banner":"Odstranit banner, který se zobrazuje na vrcholu všech stránek.","banner_note":"Uživatelé mohou odmítnout banner jeho zavřením. V jeden moment může být pouze jedno téma jako banner.","no_banner_exists":"Žádné téma není jako banner.","banner_exists":"V současnosti \u003cstrong class='badge badge-notification unread'\u003eje\u003c/strong\u003e zde téma jako banner."},"inviting":"Odesílám pozvánku...","automatically_add_to_groups":"Tato pozvánka obsahuje také přístup do těchto skupin:","invite_private":{"title":"Pozvat do konverzace","email_or_username":"Email nebo uživatelské jméno pozvaného","email_or_username_placeholder":"emailová adresa nebo uživatelské jméno","action":"Pozvat","success":"Pozvali jsme tohoto uživatele, aby se připojil do této zprávy.","success_group":"Pozvali jsme tuto skupinu, aby se připojila do této zprávy.","error":"Bohužel nastala chyba při odesílání pozvánky.","group_name":"název skupiny"},"controls":"Správa témat","invite_reply":{"title":"Pozvat k diskuzi","username_placeholder":"uživatelské jméno","action":"Poslat pozvánku","help":"pozval ostatní do tohoto tématu pomocí emailu nebo notifikací","to_forum":"Pošleme krátký email dovolující vašemu příteli se okamžitě zapojit s pomocí kliknutí na odkaz. Nebude potřeba registrace.","sso_enabled":"Zadej uživatelské jméno člověka, kterého chceš pozvat do tohoto tématu.","to_topic_blank":"Zadej uživatelské jméno a email člověka, kterého chceš pozvat do tohoto tématu.","to_topic_email":"Zadal jste emailovou adresu. Pošleme na ni pozvánku, s jejíž pomocí bude moci váš kamarád ihned odpovědět do tohoto tématu.","to_topic_username":"Zadali jste uživatelské jméno. Zašleme pozvánku s odkazem do tohoto tématu.","to_username":"Zadejte uživatelské jméno člověka, kterého chcete pozvat. Zašleme pozvánku s odkazem do tohoto tématu.","email_placeholder":"jmeno@priklad.cz","success_email":"Zaslali jsme pozvánku na \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. Upozorníme vás až bude pozvánka použita. Své pozvánky můžete sledovat v tabulce pozvánek na svém uživatelském profilu.","success_username":"Pozvali jsme zadaného uživatele, aby se zúčastnil tématu.","error":"Bohužel se nepodařilo pozvat tuto osobu. Možná už byla pozvána? (Počet opakovaných pozvánek je omezen).","success_existing_email":"Uživatel s e-mailem\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e již existuje. Pozvali jsme ho, aby se zúčastnil tohoto tématu."},"login_reply":"Přihlaste se, chcete-li odpovědět","filters":{"n_posts":{"one":"Je zobrazen pouze %{count} příspěvek","few":"Jsou zobrazeny pouze {{count}} příspěvky","many":"Je zobrazeno pouze {{count}} příspěvků","other":"Je zobrazeno pouze {{count}} příspěvků"},"cancel":"Zrušit filtr"},"split_topic":{"title":"Rozdělit téma","action":"do nového tématu","radio_label":"Nové téma","error":"Bohužel nastala chyba při rozdělování tématu.","instructions":{"one":"Chystáte se vytvořit nové téma a naplnit ho příspěvkem, který jste označili.","few":"Chystate se vytvořit noté téma a naplnit ho \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které jste označili.","many":"Chystate se vytvořit noté téma a naplnit ho \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které jste označili.","other":"Chystate se vytvořit noté téma a naplnit ho \u003cb\u003e{{count}}\u003c/b\u003e příspěvky, které jste označili."}},"merge_topic":{"title":"Sloučit téma","action":"do jiného tématu","error":"Bohužel nastala chyba při slučování tématu.","instructions":{"one":"Prosím, vyberte téma, do kterého chcete příspěvek přesunout.","few":"Prosím, vyberte téma, do kterého chcete tyto \u003cb\u003e{{count}}\u003c/b\u003e příspěvky přesunout.","many":"Prosím, vyberte téma, do kterého chcete těchto \u003cb\u003e{{count}}\u003c/b\u003e příspěvků přesunout.","other":"Prosím, vyberte téma, do kterého chcete těchto \u003cb\u003e{{count}}\u003c/b\u003e příspěvků přesunout."}},"move_to_new_message":{"radio_label":"Nová zpráva"},"merge_posts":{"title":"Sluč vybrané příspěvky","action":"sluč vybrané příspěvky","error":"Během slučování vybraných příspěvků došlo k chybě."},"change_owner":{"title":"Změnit vlastníka","action":"změnit autora","error":"Chyba při měnění autora u příspevků.","placeholder":"uživatelské jméno nového autora","instructions":{"one":"Prosíme vyberte nového vlastníka pro příspěvek od \u003cb\u003e@{{old_user}}\u003c/b\u003e","few":"Prosíme vyberte nového vlastníka pro {{count}} příspěvky od \u003cb\u003e@{{old_user}}\u003c/b\u003e","many":"Prosíme vyberte nového vlastníka pro {{count}} příspěvků od \u003cb\u003e@{{old_user}}\u003c/b\u003e","other":"Prosíme vyberte nového vlastníka pro {{count}} příspěvků od \u003cb\u003e@{{old_user}}\u003c/b\u003e"}},"change_timestamp":{"title":"Změnit časové razítko...","action":"změnit časovou značku","invalid_timestamp":"Časová značka nemůže být v budoucnosti.","error":"Nastala chyba při změně časové značky tématu.","instructions":"Zvol novou časovou značku tématu, prosím. Příspěvky v tématu se aktualizují tak aby měly stejný rozdíl v čase."},"multi_select":{"select":"vybrat","selected":"vybráno ({{count}})","select_post":{"label":"vybrat","title":"Přidat příspěvek do výběru"},"selected_post":{"label":"vybrané","title":"Kliknutím odstraníte příspěvek z výběru"},"select_replies":{"label":"vybrat +odpovědi","title":"Přidej příspěvek a všechny jeho odpovědi do výběru"},"select_below":{"label":"vybrat +níže","title":"Přidat příspěvek a vše po něm do výběru"},"delete":"smazat označené","cancel":"zrušit označování","select_all":"vybrat všechny","deselect_all":"zrušit výběr","description":{"one":"Máte označen \u003cb\u003e%{count}\u003c/b\u003e příspěvek.","few":"Máte označeny \u003cb\u003e{{count}}\u003c/b\u003e příspěvky.","many":"Máte označeno \u003cb\u003e{{count}}\u003c/b\u003e příspěvků.","other":"Máte označeno \u003cb\u003e{{count}}\u003c/b\u003e příspěvků."}}},"post":{"quote_reply":"Cituj","edit_reason":"Důvod: ","post_number":"příspěvek č. {{number}}","wiki_last_edited_on":"wiki naposledy upravena","last_edited_on":"příspěvek naposledy upraven","reply_as_new_topic":"Odpovědět v propojeném tématu","reply_as_new_private_message":"Odpověď poslat jako zprávu stejným příjemcům. ","continue_discussion":"Pokračování diskuze z {{postLink}}:","follow_quote":"přejít na citovaný příspěvek","show_full":"Zobrazit celý příspěvek","deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)","few":"(post withdrawn by author, will be automatically deleted in %{count} hours unless flagged)","many":"(post withdrawn by author, will be automatically deleted in %{count} hours unless flagged)","other":"(post withdrawn by author, will be automatically deleted in %{count} hours unless flagged)"},"collapse":"kolaps","expand_collapse":"rozbalit/sbalit","locked":"Personál znemožnil upravování na tomto příspěvku","gap":{"one":"zobrazit %{count} skrytou odpověď","few":"zobrazit {{count}} skryté odpovědi","many":"zobrazit {{count}} skrytých odpovědí","other":"zobrazit {{count}} skrytých odpovědí"},"unread":"Příspěvek je nepřečtený.","has_replies":{"one":"{{count}} odpověď","few":"{{count}} odpovědi","many":"{{count}} odpovědí","other":"{{count}} odpovědí"},"has_likes_title":{"one":"%{count} člověku se líbí tento příspěvek","few":"{{count}} lidem se líbí tento příspěvek","many":"{{count}} lidem se líbí tento příspěvek","other":"{{count}} lidem se líbí tento příspěvek"},"has_likes_title_only_you":"tento příspěvek se mi líbí","has_likes_title_you":{"one":"vám a %{count} dalšímu člověku se tento příspěvek líbí","few":"vám a {{count}} dalším lidem se tento příspěvek líbí","many":"vám a {{count}} dalším lidem se tento příspěvek líbí","other":"vám a {{count}} dalším lidem se tento příspěvek líbí"},"errors":{"create":"Bohužel nastala chyba při vytváření příspěvku. Prosím zkuste to znovu.","edit":"Bohužel nastala chyba při editaci příspěvku. Prosím zkuste to znovu.","upload":"Bohužel nastala chyba při nahrávání příspěvku. Prosím zkuste to znovu.","too_many_uploads":"Bohužel, najednou smíte nahrát jen jeden soubor.","upload_not_authorized":"Bohužel, soubor, který se snažíš nahrát, není povolený (povolená rozšíření: {{authorized_extensions}}). ","image_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat obrázky.","attachment_upload_not_allowed_for_new_user":"Bohužel, noví uživatelé nemohou nahrávat přílohy.","attachment_download_requires_login":"Omlouváme se, ale pro stáhnutí přílohy musíte být přihlášen."},"abandon_edit":{"no_value":"Nezahazovat"},"abandon":{"confirm":"Opravdu chcete svůj příspěvek zahodit?","no_value":"Nezahazovat","yes_value":"Ano, zahodit"},"via_email":"tento příspěvek byl přijat přes email","via_auto_generated_email":"tento příspěvek byl přijat přes automaticky generovaný email","whisper":"tento příspěvek je soukromé šeptání pro moderátory","wiki":{"about":"toto je wiki příspěvek"},"archetypes":{"save":"Uložit nastavení"},"few_likes_left":"Díky za šíření lásky! Zbývá ti pro dnešek už jen několik málo lajků.","controls":{"reply":"otevře okno pro sepsání odpovědi na tento příspěvek","like":"to se mi líbí","has_liked":"tento příspěvek se mi líbí","undo_like":"už se mi to nelíbí","edit":"upravit příspěvek","edit_action":"Upravit","edit_anonymous":"Omlouváme se, ale pro editaci tohoto příspěvku musíte být přihlášení.","flag":"nahlásit příspěvek moderátorovi","delete":"smazat příspěvek","undelete":"obnovit příspěvek","share":"sdílet odkaz na tento příspěvek","more":"Více","delete_replies":{"confirm":"Chceš také smazat odpovědi k tomuto příspěvku? ","direct_replies":{"one":"Ano a %{count} přímá odpověď","few":"Ano a další přímé odpovědi","many":"Ano a další {{count}} odpovědi","other":"Ano a další {{count}} odpovědi"},"all_replies":{"one":"Ano a další %{count} odpověď","few":"Ano a dalších {{count}} odpovědí","many":"Ano a dalších {{count}} odpovědí","other":"Ano a dalších {{count}} odpovědí"},"just_the_post":"Ne, pouze tento příspěvek"},"admin":"post admin actions","wiki":"Převést na wiki","unwiki":"Odstranit Wiki","convert_to_moderator":"Zvýraznit barevně","revert_to_regular":"Zrušit zvýraznění","rebake":"Obnovit HTML","unhide":"Odkrýt","change_owner":"Změnit autora","grant_badge":"Udělit odznak","lock_post":"Uzamknout příspěvek ","lock_post_description":"Zabránit přispěvatelům v úpravách tohoto příspěvku","unlock_post":"Odemknout příspěvek","unlock_post_description":"Dovolit přispěvatelům úpravy tohoto příspěvku","delete_topic_disallowed_modal":"Nemáte práva smazat toto téma. Pokud opravdu má být smazáno, označte ho pro moderátory a popište důvody.","delete_topic_disallowed":"nemáte práva smazat toto téma","delete_topic":"smazat téma"},"actions":{"flag":"Nahlásit","defer_flags":{"one":"Ignorovat nahlášení","few":"Ignorovat nahlášení","many":"Ignorovat nahlášení","other":"Ignorovat nahlášení"},"undo":{"off_topic":"Zrušit nahlášení","spam":"Zrušit nahlášení","inappropriate":"Zrušit nahlášení","bookmark":"Odebrat ze záložek","like":"Už se mi to nelíbí"},"people":{"off_topic":"označil příspěvek jako off-topic","spam":"označil příspěvek jako spam","inappropriate":"označil příspěvek jako nevhodný","notify_moderators":"označil příspěvek pro moderátora","notify_user":"odeslal zprávu","bookmark":"záložka přidána","like_capped":{"one":"a jednomu dalšímu se to líbí","few":"a {{count}} dalším se to líbí","many":"a {{count}} dalším se to líbí","other":"a {{count}} dalším se to líbí"}},"by_you":{"off_topic":"Označili jste tento příspěvek jako off-topic","spam":"Označili jste tento příspěvek jako spam","inappropriate":"Označili jste tento příspěvek jako nevhodný","notify_moderators":"Nahlásili jste tento příspěvek","notify_user":"Tomuto uživateli jste zaslali zprávu","bookmark":"Přidali jste si tento příspěvek do záložek","like":"Toto se vám líbí"}},"delete":{"confirm":{"one":"Jsi si jistý, že chceš smazat tento příspěvek?","few":"Jsi si jistý, že chceš smazat tyto všechny {{count}} příspěvky? ","many":"Jsi si jistý, že chceš smazat tyto všechny {{count}} příspěvky? ","other":"Jsi si jistý, že chceš smazat tyto všechny {{count}} příspěvky? "}},"merge":{"confirm":{"one":"Opravdu chceš sloučit tyto příspěvky?","few":"Opravdu chceš sloučit {{count}} příspěvky?","many":"Opravdu chceš sloučit {{count}} příspěvků?","other":"Opravdu chceš sloučit {{count}} příspěvků?"}},"revisions":{"controls":{"first":"První revize","previous":"Předchozí revize","next":"Další revize","last":"Poslední revize","hide":"Schovejte revizi","show":"Zobrazte revizi","revert":"Vrátit se k této revizi","edit_wiki":"Upravit Wiki","edit_post":"upravit příspěvek"},"displays":{"inline":{"title":"Vykreslený příspěvek se změnami zobrazenými v textu","button":"HTML"},"side_by_side":{"title":"Rozdíli mezi vykreslenými příspěveky vedle sebe","button":"HTML"},"side_by_side_markdown":{"title":"Show the raw source diffs side-by-side","button":"původní"}}},"raw_email":{"displays":{"raw":{"title":"Ukázat původní email","button":"původní"},"text_part":{"title":"Ukázat textovou část emailu","button":"Text"},"html_part":{"title":"Zobrazit html část emailu","button":"HTML"}}},"bookmarks":{"created":"Vytvořený","name":"Jméno"}},"category":{"can":"smí\u0026hellip; ","none":"(bez kategorie)","all":"Všechny kategorie","choose":"kategorie\u0026hellip;","edit":"Upravit","view":"Zobrazit témata v kategorii","general":"Základní","settings":"Nastavení","topic_template":"Šablona tématu","tags":"Štítky","tags_placeholder":"(Volitelné) seznam dovolených štítků","tag_groups_placeholder":"(Volitelné) seznam dovolených skupin štítků","topic_featured_link_allowed":"Povolit zobrazené odkazy v této kategorii","delete":"Smazat kategorii","create":"Nová kategorie","create_long":"Vytvořit novou kategorii","save":"Uložit kategorii","slug":"Odkaz kategorie","slug_placeholder":"(Dobrovolné) podtržená URL","creation_error":"Během vytváření nové kategorie nastala chyba.","save_error":"Během ukládání kategorie nastala chyba.","name":"Název kategorie","description":"Popis","topic":"téma kategorie","logo":"Logo kategorie","background_image":"Obrázek na pozadí této kategorie","badge_colors":"Barvy štítku","background_color":"Barva pozadí","foreground_color":"Barva textu","name_placeholder":"Měl by být krátký a výstižný.","color_placeholder":"Jakákoliv webová barva","delete_confirm":"Opravdu chcete odstranit tuto kategorii?","delete_error":"Nastala chyba při odstraňování kategorie.","list":"Seznam kategorií","no_description":"Doplňte prosím popis této kategorie.","change_in_category_topic":"navštivte téma kategorie pro editaci jejího popisu","already_used":"Tato barva je již použita jinou kategorií","security":"Zabezpečení","special_warning":"Varování: Tato kategorie je přednastavená a její nastavení bezpečnosti nelze změnit. Pokud tuto kategorii nechcete používat, tak ji smažte a nesnažte se ji měnit.","images":"Obrázky","email_in":"Vlastní příchozí emailová adresa:","email_in_allow_strangers":"Přijímat emaily i od neregistrovaných uživatelů","email_in_disabled":"Přidávání nových témat před email je zakázáno v Nastavení fóra. K povolení nových témat přes email,","email_in_disabled_click":"povolit nastavení \"email in\"","mailinglist_mirror":"Kategorie kopíruje mailing list","show_subcategory_list":"Ukázat seznam podkategorií nad tématy v této kategorii.","num_featured_topics":"Počet témat, která se zobrazují na stránce kategorie ","subcategory_num_featured_topics":"Počet zobrazených témat na stránce nadřazené kategorie:","all_topics_wiki":"Automaticky zakládat nová témata jako wiki","subcategory_list_style":"Styl seznamu podkategorií: ","sort_order":"Seznam témat seřazený podle: ","default_view":"Výchozí seznam témat: ","default_top_period":"Výchozí hlavní doba:","allow_badges_label":"Povolit používání odznaků v této kategorii","edit_permissions":"Upravit oprávnění","review_group_name":"název skupiny","require_topic_approval":"Požadovat schválení moderátorů pro všechna nová témata","require_reply_approval":"Požadovat schválení moderátorů pro všechny nové odpovědi","this_year":"letos","default_position":"Výchozí umístění","position_disabled":"Kategorie jsou zobrazovány podle pořadí aktivity. Pro kontrolu pořadí kategorií v seznamech,","position_disabled_click":"povolte nastavení \"neměnné pozice kategorií\" (fixed category positions).","minimum_required_tags":"Nejmenší počet tagů požadovaných pro téma:","parent":"Nadřazená kategorie","num_auto_bump_daily":"Počet otevřených témat, která mají být denně automaticky zvýrazněna:","navigate_to_first_post_after_read":"Přesunout na první příspěvek, jakmile jsou přečtena témata","notifications":{"watching":{"title":"Hlídání","description":"Budete automaticky sledovat všechna témata v těchto kategoriích. Budete upozorněni na každý nový příspěvek v každém tématu a zobrazí se počet nových odpovědí."},"watching_first_post":{"title":"Hlídání prvního příspěvku"},"tracking":{"title":"Sledování","description":"Budete automaticky sledovat všechna nová témata v těchto kategoriích. Budete upozorněni, pokud někdo zmíní vaše @jméno nebo vám odpoví, a zobrazí se počet nových odpovědí."},"regular":{"title":"Normální","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"muted":{"title":"Ztišený","description":"Nikdy nebudete dostávat upozornění na nová témata v těchto kategoriích a neobjeví se v aktuálních."}},"search_priority":{"options":{"normal":"Normální","ignore":"ignorovat"}},"sort_options":{"default":"výchozí","likes":"Líbí se","op_likes":"Původní \"Líbí se\" u příspěvků","views":"Zobrazení","posts":"Příspěvky","activity":"Aktivita","posters":"Přispěvatelé","category":"Kategorie","created":"Vytvořena","votes":"Hlasy"},"sort_ascending":"Vzestupně","sort_descending":"Sestupně","subcategory_list_styles":{"rows":"Řady","rows_with_featured_topics":"Řádky s vybranými tématy","boxes":"Boxy ","boxes_with_featured_topics":"Boxy s vybranými tématy"},"settings_sections":{"general":"Základní","email":"Email"}},"flagging":{"title":"Děkujeme, že pomáháte udržovat komunitu zdvořilou!","action":"Nahlásit příspěvek","take_action":"Zakročit","notify_action":"Zpráva","official_warning":"Oficiální varování","delete_spammer":"Odstranit spamera","yes_delete_spammer":"Ano, odstranit spamera","ip_address_missing":"(N/A)","hidden_email_address":"(skrytý)","submit_tooltip":"Podat soukromé nahlášení","take_action_tooltip":"Ihned dosáhni vlaječky prahu, než aby jsi čekal na více komunitních vlaječek","cant":"Bohužel nyní nemůžete tento příspěvek nahlásit.","notify_staff":"Napište členům redakce soukromě","formatted_name":{"off_topic":"Je to mimo téma.","inappropriate":"Je to nevhodné","spam":"Je to spam"},"custom_placeholder_notify_user":"Buďte věcný, konstruktivní a vždy zdvořilý.","custom_placeholder_notify_moderators":"Sdělte nám, co vás přesně trápí a kde to bude možné, tak nám poskytněte související odkazy a příklady.","custom_message":{"at_least":{"one":"zadejte alespoň %{count} znak","few":"zadejte alespoň {{count}} znaky","many":"zadejte alespoň {{count}} znaků","other":"zadejte alespoň {{count}} znaků"},"more":{"one":"ještě %{count}...","few":"ještě {{count}}...","many":"ještě {{count}}...","other":"ještě {{count}}..."},"left":{"one":"%{count} zbývá","few":"{{count}} zbývají","many":"{{count}} zbývá","other":"{{count}} zbývá"}}},"flagging_topic":{"title":"Děkujeme, že pomáháte udržovat komunitu zdvořilou!","action":"Nahlásit téma","notify_action":"Zpráva"},"topic_map":{"title":"Souhrn tématu","participants_title":"Častí přispěvatelé","links_title":"Populární odkazy","links_shown":"zobrazit více odkazů...","clicks":{"one":"%{count} kliknutí","few":"%{count} kliknutí","many":"%{count} kliknutí","other":"%{count} kliknutí"}},"post_links":{"about":"expandovat více odkazů v tomto příspěvku","title":{"one":"%{count} více","few":"%{count} více","many":"%{count} více","other":"%{count} více"}},"topic_statuses":{"warning":{"help":"Toto je oficiální varování."},"bookmarked":{"help":"V tématu je vložena záložka"},"locked":{"help":"toto téma je uzavřené; další odpovědi nejsou přijímány"},"archived":{"help":"toto téma je archivováno; je zmraženo a nelze ho již měnit"},"locked_and_archived":{"help":"Toto téma je uzavřené a archivované; další odpovědi nejsou přijímány a změny nejsou možné"},"unpinned":{"title":"Nepřipnuté","help":"Pro vás toto téma není připnuté; bude se zobrazovat v běžném pořadí"},"pinned_globally":{"title":"Připnuté globálně","help":"Toto téma je připnuté; bude se zobrazovat na vrcholu aktuálních a ve své kategorii"},"pinned":{"title":"Připnuto","help":"Pro vás je toto téma připnuté; bude se zobrazovat na vrcholu seznamu ve své kategorii"},"unlisted":{"help":"Toto téma je neviditelné; nebude se zobrazovat v seznamu témat a lze ho navštívit pouze přes přímý odkaz"}},"posts":"Příspěvků","posts_long":"v tomto tématu je {{number}} příspěvků","original_post":"Původní příspěvek","views":"Zobrazení","views_lowercase":{"one":"zobrazení","few":"zobrazení","many":"zobrazení","other":"zobrazení"},"replies":"Odpovědi","views_long":{"one":"Toto téma bylo zobrazeno %{count} krát","few":"Toto téma bylo zobrazeno {{number}} krát","many":"Toto téma bylo zobrazeno {{number}} krát","other":"Toto téma bylo zobrazeno {{number}} krát"},"activity":"Aktivita","likes":"Líbí se","likes_lowercase":{"one":"líbí se","few":"líbí se","many":"líbí se","other":"líbí se"},"likes_long":"v tomto tématu je {{number}} \"Líbí se\"","users":"Účastníci","users_lowercase":{"one":"uživatel","few":"uživatelé","many":"uživatelů","other":"uživatelů"},"category_title":"Kategorie","history":"Historie","changed_by":"od uživatele {{author}}","raw_email":{"title":"Příchozí email","not_available":"Není k dispozici!"},"categories_list":"Seznam kategorií","filters":{"with_topics":"%{filter} témata","with_category":"%{filter} %{category} témata","latest":{"title":"Aktuální","title_with_count":{"one":"Nedávné (%{count})","few":"Nedávná ({{count}})","many":"Nedávná ({{count}})","other":"Nedávná ({{count}})"},"help":"aktuální témata"},"read":{"title":"Přečtená","help":"témata, která jste si přečetli"},"categories":{"title":"Kategorie","title_in":"Kategorie - {{categoryName}}","help":"všechna témata seskupená podle kategorie"},"unread":{"title":"Nepřečtená","title_with_count":{"one":"Nepřečtená (%{count})","few":"Nepřečtená ({{count}})","many":"Nepřečtená ({{count}})","other":"Nepřečtená ({{count}})"},"help":"témata, která sledujete nebo hlídáte, s nepřečtenými příspěvky","lower_title_with_count":{"one":"{{count}} nepřečtené","few":"{{count}} nepřečtených","many":"{{count}} nepřečtených","other":"{{count}} nepřečtených"}},"new":{"lower_title_with_count":{"one":"%{count} nové","few":"{{count}} nová","many":"{{count}} nových","other":"{{count}} nových"},"lower_title":"nové","title":"Nová","title_with_count":{"one":"Nové","few":"Nová ({{count}})","many":"Nová ({{count}})","other":"Nová ({{count}})"},"help":"témata vytvořená za posledních několik dní"},"posted":{"title":"Mé příspěvky","help":"témata, do kterých jste přispěli"},"bookmarks":{"title":"Záložky","help":"témata, do kterých jste si vložili záložku"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} ({{count}})","few":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"populární témata v kategorii {{categoryName}}"},"top":{"title":"Nejlepší","help":"výběr nejlepších témat za rok, měsíc, týden nebo den","all":{"title":"Za celou dobu"},"yearly":{"title":"Ročně"},"quarterly":{"title":"Čtvrtletně"},"monthly":{"title":"Měsíčně"},"weekly":{"title":"Týdně"},"daily":{"title":"Denně"},"all_time":"Za celou dobu","this_year":"Rok","this_quarter":"Čtvrtletí","this_month":"Měsíc","this_week":"Týden","today":"Dnes","other_periods":"viz nahoře"},"votes":{"title":"Hlasy","help":"témata s nejvíce hlasy"}},"browser_update":"\u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eVáš prohlížeč je bohužel příliš starý a tyto stránky nebudou fungovat\u003c/a\u003e. Prosíme \u003ca href=\"https://browsehappy.com\"\u003epořiďte si novější verzi prohlížeče\u003c/a\u003e.","permission_types":{"full":"Vytvářet / Odpovídat / Prohlížet","create_post":"Odpovídat / Prohlížet","readonly":"Prohlížet"},"lightbox":{"download":"stáhnout"},"keyboard_shortcuts_help":{"title":"Klávesové zkratky","jump_to":{"title":"Přejít na","home":"%{shortcut} Domů","latest":"%{shortcut} Poslední","new":"%{shortcut} Nový","unread":"%{shortcut} Nepřečtěné","categories":"%{shortcut} Kategorie","top":"%{shortcut} Nahoru","bookmarks":"%{shortcut} Záložky","profile":"%{shortcut} Profil","messages":"%{shortcut} Zprávy","drafts":"%{shortcut} Koncepty"},"navigation":{"title":"Navigace","jump":"%{shortcut} Přejdi na příspěvek #","back":"%{shortcut} Zpět","up_down":"%{shortcut} Posunout označení \u0026uarr; \u0026darr;","open":"%{shortcut} Otevři vybrané téma","next_prev":"%{shortcut} Následující/předchozí výběr"},"application":{"title":"Aplikace","create":"%{shortcut} Vytvořit nové téma","notifications":"%{shortcut} Otevře upozornění","hamburger_menu":"%{shortcut} Otevře hamburgerové menu","user_profile_menu":"%{shortcut} Otevře uživatelské menu","show_incoming_updated_topics":"%{shortcut} Ukáže aktualizovaná témata","search":"%{shortcut}Vyhledávání","help":"%{shortcut} Otevře seznam klávesových zkratek","dismiss_new_posts":"%{shortcut} Označit jako přečtené nové/příspěvky","dismiss_topics":"%{shortcut} Označit témata jako přečtená","log_out":"%{shortcut} Odhlásit se"},"composing":{"title":"Skládání","return":"%{shortcut}návrat ke skládání","fullscreen":"%{shortcut} Editor na celou obrazovku"},"actions":{"title":"Akce","bookmark_topic":"Přidat záložku na téma","pin_unpin_topic":"%{shortcut} Připnout/Odepnout téma","share_topic":"%{shortcut} Sdílet téma","share_post":"%{shortcut} Sdílet příspěvek","reply_as_new_topic":"%{shortcut} Odpovědět v propojeném tématu","reply_topic":"%{shortcut} Odpovědět na téma","reply_post":"%{shortcut} Odpovědět na příspěvek","quote_post":"%{shortcut} Citovat příspěvek","like":"%{shortcut} Dát \"líbí se\" k příspěvku","flag":"%{shortcut} Nahlásit příspěvek","bookmark":"%{shortcut} Přidat záložku na příspěvek","edit":"%{shortcut} Upravit příspěvek","delete":"%{shortcut} Smazat příspěvek","mark_muted":"%{shortcut} Ztišit téma","mark_regular":"%{shortcut}Obvyklé (výchozí) téma","mark_tracking":"%{shortcut} Sledovat téma","mark_watching":"%{shortcut} Hlídat téma","print":"%{shortcut} Vytiskni téma"}},"badges":{"earned_n_times":{"one":"Získal tento odznak krát","few":"Získal tento odznak krát","many":"Získal tento odznak %{count} krát","other":"Získal tento odznak %{count} krát"},"granted_on":"Získán %{date}","others_count":"Ostatní s tímto odznakem (%{count})","title":"Odznaky","allow_title":"Tento odznak můžeš použít jako titul","multiple_grant":"Toto si můžeš zasloužit několikrát","badge_count":{"one":"%{count} odznak","few":"%{count} odznaky","many":"%{count} odznaků","other":"%{count} odznaků"},"more_badges":{"one":"+%{count} další","few":"+%{count} další","many":"+%{count} dalších","other":"+%{count} dalších"},"granted":{"one":"%{count} přidělen","few":"%{count} přidělen","many":"%{count} přidělen","other":"%{count} přidělen"},"select_badge_for_title":"Vyberte odznak, který chcete použít jako svůj titul","none":"(žádný)","successfully_granted":"Úspěšně přidělený %{badge}uživateli%{username}","badge_grouping":{"getting_started":{"name":"Jak začít?"},"community":{"name":"Komunita"},"trust_level":{"name":"Věrohodnost"},"other":{"name":"Ostatní"},"posting":{"name":"Přispívání"}}},"tagging":{"all_tags":"Všechny štítky","other_tags":"Ostatní štítky ","selector_all_tags":"všechny štítky","selector_no_tags":"bez štítků","changed":"změněné štítky:","tags":"Štítky","choose_for_topic":"volitelné štítky","add_synonyms":"Přidat","delete_tag":"Smaž štítek","delete_confirm":{"one":"Jsi si jist, že chceš smazat tento štítek a odstranit ho z tématu, kterému je přiřazen?","few":"Jsi si jist, že chceš smazat tento štítek a odstranit ho z {{count}} témat, kterým je přiřazen?","many":"Jsi si jist, že chceš smazat tento štítek a odstranit ho z {{count}} témat, kterým je přiřazen?","other":"Jsi si jist, že chceš smazat tento štítek a odstranit ho z {{count}} témat, kterým je přiřazen?"},"delete_confirm_no_topics":"Opravdu chceš smazat tento štítek? ","rename_tag":"Přejmenovat štítek","rename_instructions":"Vyber název nového štítku:","sort_by":"Seřadit dle:","sort_by_count":"počtu","sort_by_name":"jména","manage_groups":"Spravovat skupiny štítků","manage_groups_description":"Definice skupin pro organizaci štítků","upload":"Nahrát tagy","upload_instructions":"Jeden na řádek, případně se skupinou tagů ve formátu 'jméno_tagu,skupina_tagu'.","upload_successful":"Tagy úspěšně nahrány","cancel_delete_unused":"Zrušit","filters":{"without_category":"%{filter} %{tag} témata","with_category":"%{filter} %{tag} témata v %{category}","untagged_without_category":"%{filter} témata bez štítků","untagged_with_category":"%{filter} témata bez štítků v %{category}"},"notifications":{"watching":{"title":"Hlídání","description":"Budete automaticky sledovat všechna nová témata s těmito štítky. Na všechny nové příspěvky a témata budete upozorněni. Počet nových příspěvků se zobrazí vedle tématu."},"watching_first_post":{"title":"Hlídané první příspěvky"},"tracking":{"title":"Sledování","description":"Budete automaticky sledovat všechna témata s tímto tagem. Počet nepřečtených a nových příspěvků bude vidět vedle tématu."},"regular":{"title":"Běžný","description":"Budete informováni pokud někdo zmíní vaše @jméno nebo odpoví na váš příspěvek."},"muted":{"title":"Ztišené","description":"Nebudete upozorněni na žádná nová témata s tímto tagem, a nebudou se objevovat na vaší záložce s nepřečtenými."}},"groups":{"title":"Skupiny štítků","about":"Přidej štítky do skupin pro přehlednost","new":"Nová skupina","tags_label":"Štítky v této skupině:","parent_tag_label":"Nadřazený štítek:","parent_tag_placeholder":"Volitelné","parent_tag_description":"Štítky z této skupiny nemohou být použity pokud není přítomen nadřazený štítek.","one_per_topic_label":"Omezit na jeden štítek k tématu z této skupiny","new_name":"Nová skupina štítků","save":"Uložit","delete":"Smazat","confirm_delete":"Jste si jistí, že chcete smazat tuto skupinu štítků?","everyone_can_use":"Tagy mohou být použity kýmkoliv","usable_only_by_staff":"Tagy jsou viditelné pro všechny, ale jen redaktoři je mohou použít","visible_only_to_staff":"Štítky vidí pouze redaktoři"},"topics":{"none":{"unread":"Nemáte žádná nepřečtená témata.","new":"Nemáte žádná nová témata ke čtení.","read":"Zatím jste nečetli žádná témata.","posted":"Zatím jste nepřispěli do žádného tématu.","latest":"Nejsou tu žádná další témata z poslední doby k přečtení.","bookmarks":"V tématech nemáte žádné záložky.","top":"Nejsou tu žádná populární témata."},"bottom":{"latest":"Nejsou tu žádná další témata z poslední doby k přečtení.","posted":"Nejsou tu žádná další zaslaná témata k přečtení.","read":"Nejsou tu žádná další přečtená témata.","new":"Nejsou tu žádná další nová témata k přečtení.","unread":"Nejsou tu žádná další nepřečtená témata.","top":"Nejsou tu žádná další populární témata.","bookmarks":"Žádná další oblíbená témata nejsou k dispozici."}}},"invite":{"custom_message":"Aby byla pozvánka osobnější, napište \u003ca href\u003evlastní zprávu\u003c/a\u003e","custom_message_placeholder":"Vložte vlastní zprávu","custom_message_template_forum":"Ahoj! Měl by se připojit na toto fórum!","custom_message_template_topic":"Ahoj, myslím si, že by se ti mohlo tohle téma líbit!"},"forced_anonymous":"Kvůli vysoké zátěži dočasně všichni vidí stránku tak, jak by ji viděli nepřihlášení uživatelé.","safe_mode":{"enabled":"Bezpečný režim je povolený, k jeho zakázání zavři toto okno prohlížeče"},"poll":{"voters":{"one":"hlasující","few":"hlasujících","many":"hlasující","other":"hlasující"},"total_votes":{"one":"hlas celkem","few":"hlasy celkem","many":"hlasů celkem","other":"hlasů celkem"},"average_rating":"Průměrné hodnocení: \u003cstrong\u003e%{average}\u003c/strong\u003e.","multiple":{"help":{"at_least_min_options":{"one":"Zvolte alespoň \u003cstrong\u003e%{count}\u003c/strong\u003e možnost.","few":"Zvolte alespoň \u003cstrong\u003e%{count}\u003c/strong\u003e možnosti.","many":"Zvolte alespoň \u003cstrong\u003e%{count}\u003c/strong\u003e možností.","other":"Zvolte alespoň \u003cstrong\u003e%{count}\u003c/strong\u003e možností."},"up_to_max_options":{"one":"Zvolte maximálně \u003cstrong\u003e%{count}\u003c/strong\u003e možnost.","few":"Zvolte maximálně \u003cstrong\u003e%{count}\u003c/strong\u003e možnosti.","many":"Zvolte maximálně \u003cstrong\u003e%{count}\u003c/strong\u003e možností","other":"Zvolte maximálně \u003cstrong\u003e%{count}\u003c/strong\u003e možností"},"x_options":{"one":"Zvolte \u003cstrong\u003e%{count}\u003c/strong\u003e možnost.","few":"Zvolte \u003cstrong\u003e%{count}\u003c/strong\u003e možnosti.","many":"Zvolte \u003cstrong\u003e%{count}\u003c/strong\u003e možností","other":"Zvolte \u003cstrong\u003e%{count}\u003c/strong\u003e možností"},"between_min_and_max_options":"Zvolte mezi \u003cstrong\u003e%{min}\u003c/strong\u003e a \u003cstrong\u003e%{max}\u003c/strong\u003e možnostmi"}},"cast-votes":{"title":"Hlasujte","label":"Hlasovat nyní!"},"show-results":{"title":"Zobrazit výsledky hlasování","label":"Ukaž výsledky"},"hide-results":{"title":"Zpět k hlasování"},"export-results":{"label":"Export"},"open":{"title":"Otevřít hlasování","label":"Otevřít","confirm":"Opravdu chcete otevřít toto hlasování?"},"close":{"title":"Zavřít hlasování","label":"Zavřít","confirm":"Opravdu chcete uzavřít toto hlasování?"},"error_while_toggling_status":"Došlo k chybě při změně statusu hlasování","error_while_casting_votes":"Došlo k chybě při odesílání vašeho hlasu.","error_while_fetching_voters":"Došlo k chybě při zobrazování hlasujících.","ui_builder":{"title":"Vytvořit hlasování","insert":"Vložit hlasování","help":{"invalid_values":"Minimální hodnota musí být menší než maximální hodnota.","min_step_value":"Minimální hodnota kroku je 1"},"poll_type":{"label":"Typ","regular":"Jedna možnost","multiple":"Více možností","number":"Číselné hodnocení"},"poll_config":{"max":"Max","min":"Min","step":"Krok"},"poll_public":{"label":"Zobrazit kdo hlasoval"},"poll_options":{"label":"Na každý řádek zadejte jednu možnost hlasování"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Zapnout návod pro všechny nové uživatele","welcome_message":"Poslat všem novým uživatelům uvítací zprávu s rychlým návodem jak začít"}},"discourse_local_dates":{"create":{"form":{"time_title":"Čas"}}},"details":{"title":"Skrýt detaily"},"presence":{"replying":"odpovídá","editing":"upravuje"},"voting":{"reached_limit":"Došly ti hlasy. Odeber si existující hlas.","list_votes":"Seznam tvých hlasů","votes_nav_help":"témata s nejvíce hlasy","voted":"Pro toto téma jste hlasovali","allow_topic_voting":"Povolit uživatelům volit pro témata v této kategorii","vote_title":"Hlasovat","vote_title_plural":"Hlasy","voted_title":"Odhlasováno","voting_closed_title":"Uzavřeno","voting_limit":"limit"},"adplugin":{"advertisement_label":"REKLAMA"},"docker":{"upgrade":"Vaše instalace Discourse je zastaralá.","perform_upgrade":"Klikněte zde pro aktualizaci."}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm","medium_with_ago":{"x_months":{"other":"%{count} 个月前"},"x_years":{"other":"%{count} 年前"}}},"share":{"topic_html":"主题: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e"},"action_codes":{"forwarded":"转发上述邮件"},"topic_admin_menu":"管理主题","themes":{"broken_theme_alert":"因为主题或组件%{theme}有错误，你的网站可能无法正常运行。 在%{path}禁用它。"},"s3":{"regions":{"ca_central_1":"加拿大（中部）","eu_north_1":"欧洲（斯德哥尔摩）","sa_east_1":"南美（圣保罗）","us_gov_east_1":"AWS 政府云（US-East）","us_gov_west_1":"AWS 政府云（US-West）"}},"go_ahead":"继续","conduct":"行为准则","bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","next_business_day":"下一个工作日","start_of_next_business_week":"下周一","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"drafts":{"abandon":{"confirm":"你已在此主题中打开了另一个草稿。 你确定要舍弃它吗？"}},"pwa":{"install_banner":"你想要\u003ca href\u003e安装%{title}在此设备上吗？\u003c/a\u003e"},"choose_topic":{"title":{"search":"搜索主题","placeholder":"在此处输入主题标题、URL 或 ID"}},"choose_message":{"none_found":"无符合的结果","title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"order_by":"排序依据","explain":{"why":"解释为什么该项目最终进入队列","title":"需审核评分","formula":"公式","subtotal":"小计","min_score_visibility":"可见的最低分数","score_to_hide":"隐藏帖子的分数","take_action_bonus":{"name":"立即执行","title":"当工作人员选择采取行动时，会给标记加分。"},"user_accuracy_bonus":{"name":"用户准确性","title":"先前已同意其标记的用户将获得奖励。"},"trust_level_bonus":{"name":"信任等级","title":"待审阅项目由较高信任级别且具有较高分数的用户创建的。"},"type_bonus":{"name":"奖励类型","title":"某些可审核类型可以由管理人员加权，以使其具有更高的优先级。"}},"claim_help":{"optional":"你可以认领此条目以避免被他人审核。","required":"在你审核之前你必须认领此条目。","claimed_by_you":"你已认领此条目现在可以审核了。","claimed_by_other":"此条目仅可被\u003cb\u003e{{username}}\u003c/b\u003e审核。"},"claim":{"title":"认领该主题"},"unclaim":{"help":"移除该认领"},"awaiting_approval":"需要审核","settings":{"saved":"已保存！","priorities":{"title":"需审核优先级"}},"view_all":"查看全部","grouped_by_topic":"依据主题分组","none":"没有项目需要审核","view_pending":"查看待审核","topic_has_pending":{"other":"该主题中有 \u003cb\u003e{{count}}\u003c/b\u003e 个帖等待审核中"},"title":"审核","filtered_topic":"您正在选择性地查看这一主题中的可审核内容。","show_all_topics":"显示所有主题","deleted_post":"(已删除的帖子)","deleted_user":"(已删除的用户)","user":{"bio":"简介","website":"网站","fields":"字段"},"user_percentage":{"summary":{"other":"{{agreed}}，{{disagreed}}，{{ignored}}（共{{count}}个标记）"},"agreed":{"other":"{{count}}%同意"},"disagreed":{"other":"{{count}}%不同意"},"ignored":{"other":"{{count}}%忽略"}},"topics":{"reviewable_count":"计数","reported_by":"报告人","deleted":"[已删除的主题]","original":"（原主题）","unique_users":{"other":"{{count}} 位用户"}},"replies":{"other":"{{count}} 个回复"},"new_topic":"批准此条目将会创建一个新的主题","filters":{"all_categories":"（所有分类）","type":{"all":"(全部类型)"},"minimum_score":"最低分：","status":"状态","orders":{"priority":"优先级","priority_asc":"优先级（倒序）","created_at":"创建时间","created_at_asc":"创建时间（倒序）"},"priority":{"title":"最低优先级","low":"（所有）","medium":"中","high":"高"}},"conversation":{"view_full":"查看完整对话"},"scores":{"about":"该分数是根据报告者的信任等级、该用户以往举报的准确性以及被举报条目的优先级计算得出的。","score":"评分","date":"日期","status":"状态","submitted_by":"提交人","reviewed_by":"审核者"},"statuses":{"approved":{"title":"已批准"},"ignored":{"title":"忽略"},"deleted":{"title":"已删除"},"reviewed":{"title":"（所有已审核）"},"all":{"title":"（全部）"}},"types":{"reviewable_flagged_post":{"title":"被标记的帖子","flagged_by":"标记者"},"reviewable_queued_topic":{"title":"队列中到主题"},"reviewable_queued_post":{"title":"队列中的帖子"}},"approval":{"pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 个帖子在等待审核中。"}}},"directory":{"last_updated":"最近更新："},"groups":{"member_requested":"请求于","requests":{"title":"请求","accept":"接受","deny":"拒绝","denied":"已拒绝","undone":"撤销请求","handle":"处理成员请求"},"empty":{"requests":"没有请求加入此群组的请求。"},"confirm_leave":"你确定要离开这个群组吗？","allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）","members":{"forbidden":"你不可以查看成员列表。"},"alias_levels":{"owners_mods_and_admins":"仅群组成员、版主与管理员"},"notifications":{"watching_first_post":{"description":"你将收到有关此组中新消息的通知，但不会回复消息。"},"muted":{"description":"你不会收到有关此组中消息的任何通知。"}},"flair_url_description":"使用不小于20px × 20px的方形图像或FontAwesome图标（可接受的格式：“fa-icon”，“far fa-icon”或“fab fa-icon”）。"},"categories":{"topic_stat_sentence_week":{"other":"过去一周有%{count}个新主题。"},"topic_stat_sentence_month":{"other":"过去一个月有%{count}个新主题。"}},"user":{"user_notifications":{"ignore_duration_title":"忽略计时器","ignore_duration_when":"持续时间：","ignore_duration_note":"请注意所有忽略的项目会在忽略的时间段过去后被自动移除","ignore_duration_time_frame_required":"请选择时间范围","ignore_no_users":"你没有忽视任何用户","ignore_option":"忽略","ignore_option_title":"你将不会收到关于此用户的通知并且隐藏其所有帖子及回复。","add_ignored_user":"添加...","mute_option_title":"你不会收到任何关于此用户的通知","normal_option_title":"如果用户回复、引用或提到你，你将会收到消息。"},"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","timezone":"时区","dynamic_favicon":"在浏览器图标上显示计数","theme_default_on_all_devices":"将其设为我所有设备上的默认主题","text_size_default_on_all_devices":"将其设为我所有设备上的默认字体大小","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","ignored_users":"忽视","ignored_users_instructions":"封禁所有来自这些用户的帖子和通知。","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor_backup":{"manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","use":"使用备份码","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。"},"second_factor":{"enable":"管理两步验证","forgot_password":"忘记密码？","enable_description":"使用我们支持的应用 (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) 扫描此二维码并输入您的授权码。\n","short_description":"使用一次性安全码保护你的账户。\n","use":"使用身份验证器应用","enforced_notice":"在访问此站点之前，你需要启用双重身份验证。","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","default_name":"我的身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"register":"注册","title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"email":{"sso_override_instructions":"电子邮件地址可以通过SSO登录来更新。"},"associated_accounts":{"confirm_modal_title":"连接%{provider}帐号","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"auth_tokens":{"was_this_you_description":"如果不是你，我们建议你更改密码并在任何地方注销。","secure_account":"保护我的账户","latest_post":"你上次发布了......"},"enable_physical_keyboard":"在iPad上启用物理键盘支持","text_size":{"title":"文本大小","smaller":"更小","larger":"更大","largest":"最大"},"title_count_mode":{"title":"背景页面标题显示计数：","notifications":"新通知","contextual":"新建页面内容"},"email_digests":{"title":"长期未访问时发送热门主题和回复的摘要邮件"},"email_level":{"only_when_away":"只在离开时"},"invited":{"sent":"上次发送","rescind_all":"移除所有过期邀请","rescinded_all":"所有过期邀请已删除！","rescind_all_confirm":"你确定你想要移除所有过期邀请么？","bulk_invite":{"confirmation_message":"你将通过电子邮件将邀请发送给在上传的文件中的每一个人。"}}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"create_account":{"disclaimer":"注册即表示你同意\u003ca href='{{privacy_link}}' target='blank'\u003e隐私策略\u003c/a\u003e和\u003ca href='{{tos_link}}' target='blank'\u003e服务条款\u003c/a\u003e。"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"email_login":{"logging_in_as":"用%{email}登录","confirm_button":"登录完成"},"login":{"second_factor_backup":"使用备用码登录","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","sent_activation_email_again_generic":"我们发送了另一封激活邮件。它可能需要几分钟才能到达；记得检查你的垃圾邮件文件夹。","discord":{"title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP","backup_code":"使用备份码"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"shortcut_modifier_key":{"enter":"回车"},"category_row":{"topic_count":"{{count}}个主题在此分类中"},"select_kit":{"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"emoji_picker":{"smileys_\u0026_emotion":"笑脸与情感","people_\u0026_body":"人与身体","animals_\u0026_nature":"动物与自然","food_\u0026_drink":"饮食","travel_\u0026_places":"旅行与地点","activities":"活动","symbols":"符号"},"composer":{"edit_conflict":"编辑冲突","reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","try_like":"试试{{heart}}按钮？","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"reply_placeholder_choose_category":"输入前请选择一个分类。","saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","open":"打开编辑面板","composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"post_approved":"你的帖子已被审核","reviewable_items":"待审核帖子","liked_consolidated_description":{"other":"你的帖子有{{count}}个赞"},"membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","popup":{"watching_first_post":"{{username}}发布了新主题“{{topic}}” - {{site_title}}","custom":"来自{{username}}在%{site_title}的通知"},"titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","liked":"新到赞","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","liked_consolidated":"新的赞","post_approved":"帖子已审批","membership_request_consolidated":"新的成员申请"}},"search":{"context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"filters":{"created":"我创建的"},"statuses":{"public":"是公开的"}}},"view_all":"查看全部","topic":{"defer":{"help":"标记为未读"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"num_of_days":"天数","time_frame_required":"请选择一个时间范围"},"auto_update_input":{"two_months":"两个月","four_months":"四个月"},"auto_bump":{"title":"自动顶帖"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_bump":"此主题将在%{timeLeft}后自动顶起。","auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"progress":{"jump_prompt_long":"跳到……"},"share":{"extended_title":"分享一个链接"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"move_to":{"title":"移动到","action":"移动到","error":"移动帖子时发生了错误。"},"split_topic":{"topic_name":"新主题的标题"},"merge_topic":{"radio_label":"现存的主题"},"move_to_new_message":{"title":"移动到新的即时信息","action":"移动到新的私信","message_title":"新私信的标题","participants":"参与者","instructions":{"other":"你正在发送\u003cb\u003e{{count}}\u003c/b\u003e篇帖子到一条新的私信/消息。"}},"move_to_existing_message":{"title":"移动到现存的私信","action":"移动到已存在的私信","radio_label":"现存的私信","participants":"参与者","instructions":{"other":"请选择你要将\u003cb\u003e{{count}}\u003c/b\u003e个帖子所移动到的私信。"}},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"ignored":"忽视的内容","show_hidden":"显示已忽略内容。","notice":{"new_user":"这是 {{user}} 发的第一个帖子 - 让我们欢迎他加入社区！","returning_user":"从我们上一次看到 {{user}} 有一阵子了 — 他上次发帖是 {{time}}."},"errors":{"file_too_large":"抱歉，该文件太大（最大大小为 {{max_size_kb}}KB）。为什么不将您的大文件上传到云共享服务，然后粘贴链接？","too_many_dragged_and_dropped_files":"抱歉，你一次只能上传最多{{max}}个文件。"},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"controls":{"read_indicator":"阅读了帖子的用户","add_post_notice":"添加管理人员通知","remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"edit_dialog_title":"编辑: %{categoryName}","tags_allowed_tags":"限制这些标签只能用在此分类","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","manage_tag_groups_link":"管理这里的标签组。","allow_global_tags_label":"也允许其它标签","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","position":"分类页面位置：","notifications":{"watching_first_post":{"description":"你将收到此分类中的新主题通知，不包括回复。"}},"search_priority":{"label":"搜索优先级","options":{"very_low":"非常低","low":"低","high":"高","very_high":"非常高"}},"settings_sections":{"moderation":"审核","appearance":"主题"}},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","close":"关闭(Esc)","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","navigation":{"go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"upload_description":"上传csv文件以批量创建标签","delete_unused_confirmation":{"other":"%{count}标签将被删除：%{tags}"},"delete_unused_confirmation_more_tags":{"other":"%{tags}和%{count}更多"},"delete_unused":"删除未使用的标签","delete_unused_description":"删除所有未与主题或私信关联的标签","notifications":{"watching_first_post":{"description":"你将会收到此标签中的新主题的通知，但对主题的回复则不会。"}},"groups":{"tags_placeholder":"标签","name_placeholder":"标签组名称"}},"poll":{"public":{"title":"投票为\u003cstrong\u003e公开\u003c/strong\u003e。"},"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_result":{"label":"结果","always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"today":"今天%{time}","tomorrow":"明天%{time}","yesterday":"昨天%{time}","countdown":{"passed":"日期已过"}},"title":"插入日期/时间","create":{"form":{"insert":"插入","advanced_mode":"高级模式","simple_mode":"简单模式","format_description":"向用户显示日期的格式。 使用“\\T\\Z”以单词显示用户时区（欧洲/巴黎）","timezones_title":"要显示的时区","timezones_description":"时区将用于在预览和撤回中显示日期。","recurring_title":"循环","recurring_description":"定义重复事件。你还可以手动编辑表单生成的周期性选项，并使用以下键之一：年，季，月，周，日，小时，分钟，秒，毫秒。","recurring_none":"没有循环","invalid_date":"日期无效，请确保日期和时间正确","date_title":"日期","format_title":"日期格式","timezone":"时区","until":"直到......","recurring":{"every_day":"每天","every_week":"每周","every_two_weeks":"每两周","every_month":"每月","every_two_months":"每两个月","every_three_months":"每三个月","every_six_months":"每六个月","every_year":"每年"}}}},"presence":{"replying_to_topic":{"other":"正在回复"}},"voting":{"title":"投票","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"anonymous_button":{"other":"投票"},"remove_vote":"移除投票"}}},"en":{"js":{"dates":{"medium_with_ago":{"x_months":{"one":"%{count} month ago"},"x_years":{"one":"%{count} year ago"}}},"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"categories":{"topic_stat_sentence_week":{"one":"%{count} new topic in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month."}},"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}},"liked_consolidated_description":{"one":"liked {{count}} of your posts"}},"topic":{"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"controls":{"publish_page":"Page Publishing"},"actions":{"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"read_capped":{"one":"and {{count}} other read this"}}}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."},"delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'cs';
I18n.pluralizationRules.cs = MessageFormat.locale.cs;
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


    var months = 'leden_únor_březen_duben_květen_červen_červenec_srpen_září_říjen_listopad_prosinec'.split('_'),
        monthsShort = 'led_úno_bře_dub_kvě_čvn_čvc_srp_zář_říj_lis_pro'.split('_');

    var monthsParse = [/^led/i, /^úno/i, /^bře/i, /^dub/i, /^kvě/i, /^(čvn|červen$|června)/i, /^(čvc|červenec|července)/i, /^srp/i, /^zář/i, /^říj/i, /^lis/i, /^pro/i];
    // NOTE: 'červen' is substring of 'červenec'; therefore 'červenec' must precede 'červen' in the regex to be fully matched.
    // Otherwise parser matches '1. červenec' as '1. červen' + 'ec'.
    var monthsRegex = /^(leden|únor|březen|duben|květen|červenec|července|červen|června|srpen|září|říjen|listopad|prosinec|led|úno|bře|dub|kvě|čvn|čvc|srp|zář|říj|lis|pro)/i;

    function plural(n) {
        return (n > 1) && (n < 5) && (~~(n / 10) !== 1);
    }
    function translate(number, withoutSuffix, key, isFuture) {
        var result = number + ' ';
        switch (key) {
            case 's':  // a few seconds / in a few seconds / a few seconds ago
                return (withoutSuffix || isFuture) ? 'pár sekund' : 'pár sekundami';
            case 'ss': // 9 seconds / in 9 seconds / 9 seconds ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'sekundy' : 'sekund');
                } else {
                    return result + 'sekundami';
                }
                break;
            case 'm':  // a minute / in a minute / a minute ago
                return withoutSuffix ? 'minuta' : (isFuture ? 'minutu' : 'minutou');
            case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'minuty' : 'minut');
                } else {
                    return result + 'minutami';
                }
                break;
            case 'h':  // an hour / in an hour / an hour ago
                return withoutSuffix ? 'hodina' : (isFuture ? 'hodinu' : 'hodinou');
            case 'hh': // 9 hours / in 9 hours / 9 hours ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'hodiny' : 'hodin');
                } else {
                    return result + 'hodinami';
                }
                break;
            case 'd':  // a day / in a day / a day ago
                return (withoutSuffix || isFuture) ? 'den' : 'dnem';
            case 'dd': // 9 days / in 9 days / 9 days ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'dny' : 'dní');
                } else {
                    return result + 'dny';
                }
                break;
            case 'M':  // a month / in a month / a month ago
                return (withoutSuffix || isFuture) ? 'měsíc' : 'měsícem';
            case 'MM': // 9 months / in 9 months / 9 months ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'měsíce' : 'měsíců');
                } else {
                    return result + 'měsíci';
                }
                break;
            case 'y':  // a year / in a year / a year ago
                return (withoutSuffix || isFuture) ? 'rok' : 'rokem';
            case 'yy': // 9 years / in 9 years / 9 years ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'roky' : 'let');
                } else {
                    return result + 'lety';
                }
                break;
        }
    }

    var cs = moment.defineLocale('cs', {
        months : months,
        monthsShort : monthsShort,
        monthsRegex : monthsRegex,
        monthsShortRegex : monthsRegex,
        // NOTE: 'červen' is substring of 'červenec'; therefore 'červenec' must precede 'červen' in the regex to be fully matched.
        // Otherwise parser matches '1. červenec' as '1. červen' + 'ec'.
        monthsStrictRegex : /^(leden|ledna|února|únor|březen|března|duben|dubna|květen|května|červenec|července|červen|června|srpen|srpna|září|říjen|října|listopadu|listopad|prosinec|prosince)/i,
        monthsShortStrictRegex : /^(led|úno|bře|dub|kvě|čvn|čvc|srp|zář|říj|lis|pro)/i,
        monthsParse : monthsParse,
        longMonthsParse : monthsParse,
        shortMonthsParse : monthsParse,
        weekdays : 'neděle_pondělí_úterý_středa_čtvrtek_pátek_sobota'.split('_'),
        weekdaysShort : 'ne_po_út_st_čt_pá_so'.split('_'),
        weekdaysMin : 'ne_po_út_st_čt_pá_so'.split('_'),
        longDateFormat : {
            LT: 'H:mm',
            LTS : 'H:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D. MMMM YYYY',
            LLL : 'D. MMMM YYYY H:mm',
            LLLL : 'dddd D. MMMM YYYY H:mm',
            l : 'D. M. YYYY'
        },
        calendar : {
            sameDay: '[dnes v] LT',
            nextDay: '[zítra v] LT',
            nextWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[v neděli v] LT';
                    case 1:
                    case 2:
                        return '[v] dddd [v] LT';
                    case 3:
                        return '[ve středu v] LT';
                    case 4:
                        return '[ve čtvrtek v] LT';
                    case 5:
                        return '[v pátek v] LT';
                    case 6:
                        return '[v sobotu v] LT';
                }
            },
            lastDay: '[včera v] LT',
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[minulou neděli v] LT';
                    case 1:
                    case 2:
                        return '[minulé] dddd [v] LT';
                    case 3:
                        return '[minulou středu v] LT';
                    case 4:
                    case 5:
                        return '[minulý] dddd [v] LT';
                    case 6:
                        return '[minulou sobotu v] LT';
                }
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : 'za %s',
            past : 'před %s',
            s : translate,
            ss : translate,
            m : translate,
            mm : translate,
            h : translate,
            hh : translate,
            d : translate,
            dd : translate,
            M : translate,
            MM : translate,
            y : translate,
            yy : translate
        },
        dayOfMonthOrdinalParse : /\d{1,2}\./,
        ordinal : '%d.',
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return cs;

})));

// moment-timezone-localization for lang code: cs

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidžan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Abeba","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Alžír","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Káhira","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Džibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Chartúm","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lomé","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadišu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndžamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nuakšott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Svatý Tomáš","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripolis","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucuman","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahía","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belém","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogotá","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancún","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Kajmanské ostrovy","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Córdoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Kostarika","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominika","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamajka","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceio","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinik","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlán","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Ciudad de México","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Severní Dakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Severní Dakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Severní Dakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Portoriko","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarém","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"São Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Svatý Bartoloměj","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"Svatý Kryštof","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"Svatá Lucie","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"Svatý Tomáš (Karibik)","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"Svatý Vincenc","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Ammán","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktobe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ašchabad","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyrau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bagdád","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrajn","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Bejrút","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Biškek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunej","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kalkata","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Čita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Čojbalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Kolombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damašek","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dháka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubaj","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dušanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hongkong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Jakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jeruzalém","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kábul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamčatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karáčí","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Káthmándú","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Chandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnojarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kučing","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuvajt","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Macao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Maskat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nikósie","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuzněck","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Uralsk","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnompenh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pchjongjang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Katar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kyzylorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangún","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Rijád","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Či Minovo město","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sachalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Soul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Šanghaj","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapur","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Sredněkolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Tchaj-pej","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taškent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Teherán","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimbú","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokio","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulánbátar","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumči","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Jakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Jekatěrinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Jerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azorské ostrovy","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermudy","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Kanárské ostrovy","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Kapverdy","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Faerské ostrovy","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavík","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Jižní Georgie","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"Svatá Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Koordinovaný světový čas","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrachaň","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Athény","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Bělehrad","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlín","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Brusel","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bukurešť","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapešť","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Kišiněv","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kodaň","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Irský letní časDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinky","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Ostrov Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kyjev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisabon","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Lublaň","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Britský letní časLondýn","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Lucemburk","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monako","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskva","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paříž","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praha","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Řím","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofie","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stockholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirana","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Uljanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Užhorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatikán","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Vídeň","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varšava","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Záhřeb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Záporoží","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Curych","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Vánoční ostrov","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Kokosové ostrovy","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Komory","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelenovy ostrovy","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahé","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maledivy","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauricius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Réunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chathamské ostrovy","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Velikonoční ostrov","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Éfaté","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fidži","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapágy","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambierovy ostrovy","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"HSTHSTHDTHonolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Markézy","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Nouméa","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairnovy ostrovy","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuukské ostrovy","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
